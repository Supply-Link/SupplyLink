// SessionProvider — server URL persistence, sign-in/out, licence polling
// with AppState-aware timer, workspace snapshot, request() with CSRF
// and busy guard, and idempotency key store.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert, AppState } from 'react-native';
import { Api, ApiFailure, NetworkError } from '@/lib/api';
import { DEFAULT_SERVER, LICENCE_POLL_MS, OUTBOX_STORAGE_KEY, ROLE, SERVER_STORAGE_KEY } from '@/lib/config';
import { licenceRemainingMs, normaliseServer } from '@/lib/rules';
import type { AuthResponse, Licence, User, Workspace } from '@/lib/types';
import { useToast } from './ToastProvider';

export type Phase = 'signedOut' | 'locked' | 'ready';

/** A write that could not reach the server; replayed (same idempotency key) once the connection returns. */
export interface OutboxItem {
  id: string;
  userId: string;
  path: string;
  body: object;
  key: string;
  label: string;
  orderId?: string;
}

/** What request() resolves with when a write was saved to the outbox instead of sent. */
export interface Queued {
  queued: true;
}

export function isQueued(value: unknown): value is Queued {
  return typeof value === 'object' && value !== null && (value as Queued).queued === true;
}

interface RequestOptions {
  idempotencyKey?: string;
  /** If the network is down, keep this POST and send it later instead of failing. */
  queue?: { label: string; orderId?: string };
  /** Background requests never show errors or the activity label. */
  silent?: boolean;
}

interface Session {
  hydrated: boolean;
  phase: Phase;
  /** Changes whenever business data is purged, so dependants can discard their own copies. */
  epoch: number;
  serverUrl: string;
  user: User | null;
  licence: Licence;
  licenceExpired: boolean;
  workspace: Workspace | null;
  busy: boolean;
  activity: string;
  /** True after a request failed to reach the server; clears on the next success. */
  offline: boolean;
  /** When the workspace was last loaded from the server (ms), or 0. */
  lastSynced: number;
  /** Saved writes waiting for a connection, for the signed-in user. */
  pending: OutboxItem[];
  request<T>(method: 'GET' | 'POST', path: string, body?: object, options?: RequestOptions): Promise<T | undefined>;
  setServer(input: string): Promise<boolean>;
  signIn(server: string, email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
  checkLicence(): Promise<void>;
  keyFor(scope: string): string;
  dropKey(scope: string): void;
  showError(message: string): void;
}

const SessionContext = createContext<Session | null>(null);
const MAX_TIMER_MS = 2 ** 31 - 1;

function showError(message: string) {
  Alert.alert('Something went wrong', message);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const apiRef = useRef(new Api(DEFAULT_SERVER));
  const [hydrated, setHydrated] = useState(false);
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER);
  const [signedIn, setSignedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [licence, setLicence] = useState<Licence>({});
  const [licenceOk, setLicenceOk] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState('');
  const [epoch, setEpoch] = useState(0);
  const [offline, setOffline] = useState(false);
  const [lastSynced, setLastSynced] = useState(0);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const outboxLoaded = useRef(false);
  const flushing = useRef(false);
  const wasOffline = useRef(false);

  const signedInRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const licenceUsableRef = useRef(false);
  const deadlineRef = useRef(0);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const keys = useRef(new Map<string, string>());

  useEffect(() => {
    AsyncStorage.getItem(SERVER_STORAGE_KEY)
      .then((saved) => {
        if (saved) {
          apiRef.current.base = saved;
          setServerUrl(saved);
        }
      })
      .finally(() => setHydrated(true));
    AsyncStorage.getItem(OUTBOX_STORAGE_KEY)
      .then((saved) => {
        if (saved) setOutbox(JSON.parse(saved) as OutboxItem[]);
      })
      .catch(() => undefined)
      .finally(() => {
        outboxLoaded.current = true;
      });
  }, []);

  useEffect(() => {
    if (!outboxLoaded.current) return;
    AsyncStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(outbox)).catch(() => undefined);
  }, [outbox]);

  /** Drops every piece of business data held in memory. */
  const purge = useCallback(() => {
    setWorkspace(null);
    keys.current.clear();
    setEpoch((n) => n + 1);
  }, []);

  const usableNow = useCallback(
    () => licenceUsableRef.current && Date.now() < deadlineRef.current,
    [],
  );

  const applyLicence = useCallback(
    (value: Licence) => {
      clearTimeout(expiryTimer.current);
      setLicence(value);
      licenceUsableRef.current = value.usable === true;
      const remaining = value.usable ? licenceRemainingMs(value.server_time, value.expires_at) : 0;
      deadlineRef.current = Date.now() + remaining;
      const watch = () => {
        const left = deadlineRef.current - Date.now();
        if (left > 0) expiryTimer.current = setTimeout(watch, Math.min(left, MAX_TIMER_MS));
        else {
          setLicenceOk(false);
          purge();
        }
      };
      setLicenceOk(remaining > 0);
      if (remaining > 0) watch();
      else purge();
    },
    [purge],
  );

  const endSession = useCallback(() => {
    apiRef.current.clear();
    signedInRef.current = false;
    setSignedIn(false);
    setUser(null);
    applyLicence({});
  }, [applyLicence]);

  const request = useCallback(
    async <T,>(method: 'GET' | 'POST', path: string, body?: object, options: RequestOptions = {}) => {
      const exempt = path === '/api/logout' || path === '/api/license';
      if (signedInRef.current && !usableNow() && !exempt) {
        setLicenceOk(false);
        purge();
        return undefined;
      }
      if (busyRef.current) {
        if (!options.silent) toast('Please wait for the current request.');
        return undefined;
      }
      busyRef.current = true;
      setBusy(true);
      if (!options.silent) setActivity('Connecting to your server…');
      try {
        const result = await apiRef.current.call<T>(method, path, body, options.idempotencyKey);
        setOffline(false);
        return result;
      } catch (error) {
        if (error instanceof NetworkError) {
          setOffline(true);
          const uid = userIdRef.current;
          if (options.queue && method === 'POST' && body && options.idempotencyKey && uid) {
            const item: OutboxItem = {
              id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
              userId: uid,
              path,
              body,
              key: options.idempotencyKey,
              label: options.queue.label,
              orderId: options.queue.orderId,
            };
            setOutbox((list) => [...list, item]);
            return { queued: true } as unknown as T;
          }
        } else setOffline(false);
        if (error instanceof ApiFailure && error.status === 423) {
          applyLicence((error.payload.license as Licence | undefined) ?? {});
          if (!signedInRef.current) showError(error.message);
          return undefined;
        }
        if (error instanceof ApiFailure && error.status === 401 && signedInRef.current) endSession();
        if (!options.silent) {
          showError(error instanceof Error && error.message ? error.message : "Can't reach SupplyLink right now. Check your internet connection and try again.");
        }
        return undefined;
      } finally {
        busyRef.current = false;
        setBusy(false);
        setActivity('');
      }
    },
    [applyLicence, endSession, purge, toast, usableNow],
  );

  const refresh = useCallback(async () => {
    const result = await request<Workspace>('GET', '/api/state');
    if (result) {
      setWorkspace(result);
      setUser(result.user);
      setLastSynced(Date.now());
    }
  }, [request]);

  const setServer = useCallback(
    async (input: string) => {
      let base: string;
      try {
        base = normaliseServer(input, __DEV__);
      } catch (error) {
        showError((error as Error).message);
        return false;
      }
      const api = apiRef.current;
      if (base !== api.base) api.clear();
      api.base = base;
      setServerUrl(base);
      await AsyncStorage.setItem(SERVER_STORAGE_KEY, base);
      return true;
    },
    [],
  );

  const signIn = useCallback(
    async (server: string, email: string, password: string) => {
      if (!(await setServer(server))) return;
      apiRef.current.clear();
      const result = await request<AuthResponse>('POST', '/api/login', { email: email.trim(), password });
      if (!result) return;
      if (result.user.role !== ROLE) {
        await request('POST', '/api/logout', {});
        apiRef.current.clear();
        showError(`Use a ${ROLE} account in this app. Administrators and distributors use the web portal.`);
        return;
      }
      setUser(result.user);
      applyLicence(result.license);
      signedInRef.current = true;
      setSignedIn(true);
      if (usableNow()) void refresh();
    },
    [applyLicence, refresh, request, setServer, usableNow],
  );

  const signOut = useCallback(async () => {
    await request('POST', '/api/logout', {});
    endSession();
  }, [endSession, request]);

  /** Applies a fetched licence and loads the workspace when it unlocks. */
  const adoptLicence = useCallback(
    (value: Licence) => {
      const wasUsable = usableNow();
      applyLicence(value);
      if (!wasUsable && usableNow() && signedInRef.current) void refresh();
    },
    [applyLicence, refresh, usableNow],
  );

  const checkLicence = useCallback(async () => {
    const result = await request<Licence>('GET', '/api/license');
    if (result) adoptLicence(result);
  }, [adoptLicence, request]);

  userIdRef.current = user?.id ?? null;

  const phase: Phase = !signedIn ? 'signedOut' : licenceOk ? 'ready' : 'locked';

  useEffect(() => {
    if (!signedIn) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const poll = async () => {
      if (busyRef.current) return;
      const result = await request<Licence>('GET', '/api/license', undefined, { silent: true });
      if (result) adoptLicence(result);
    };
    const start = () => {
      clearInterval(timer);
      void poll();
      timer = setInterval(poll, LICENCE_POLL_MS);
    };
    start();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
      else clearInterval(timer);
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [adoptLicence, request, signedIn]);

  useEffect(() => () => clearTimeout(expiryTimer.current), []);

  const pending = useMemo(() => outbox.filter((item) => item.userId === user?.id), [outbox, user?.id]);

  // Replays saved writes oldest-first once the connection is back, then reloads the workspace.
  useEffect(() => {
    const reconnected = wasOffline.current && !offline;
    wasOffline.current = offline;
    if (!signedIn || !licenceOk || offline || flushing.current) return;
    if (pending.length === 0) {
      if (reconnected) void refresh();
      return;
    }
    flushing.current = true;
    (async () => {
      let synced = false;
      for (const item of pending) {
        try {
          await apiRef.current.call('POST', item.path, item.body, item.key);
          synced = true;
        } catch (error) {
          if (error instanceof NetworkError) {
            setOffline(true);
            break;
          }
          if (error instanceof ApiFailure && (error.status === 401 || error.status === 423)) break;
          showError(`Couldn't sync "${item.label}": ${error instanceof Error ? error.message : 'it was rejected.'}`);
        }
        setOutbox((list) => list.filter((entry) => entry.id !== item.id));
      }
      flushing.current = false;
      if (synced) void request<Workspace>('GET', '/api/state', undefined, { silent: true }).then((result) => {
        if (result) {
          setWorkspace(result);
          setUser(result.user);
          setLastSynced(Date.now());
        }
      });
    })();
  }, [licenceOk, offline, pending, refresh, request, signedIn]);

  const keyFor = useCallback((scope: string) => {
    let key = keys.current.get(scope);
    if (!key) {
      key = `sl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      keys.current.set(scope, key);
    }
    return key;
  }, []);

  const dropKey = useCallback((scope: string) => {
    keys.current.delete(scope);
  }, []);

  const value = useMemo<Session>(
    () => ({
      hydrated,
      phase,
      epoch,
      serverUrl,
      user,
      licence,
      licenceExpired: licence.status === 'expired' || (licence.usable === true && !licenceOk),
      workspace,
      busy,
      activity,
      offline,
      lastSynced,
      pending,
      request,
      setServer,
      signIn,
      signOut,
      refresh,
      checkLicence,
      keyFor,
      dropKey,
      showError,
    }),
    [activity, busy, offline, lastSynced, pending, checkLicence, dropKey, epoch, hydrated, keyFor, licence, licenceOk, phase, refresh, request, serverUrl, signIn, signOut, setServer, user, workspace],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}
