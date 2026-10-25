"""Small local LDAPv3 directory: simple bind, scoped search, unbind, Who Am I.

It is deliberately read-only over LDAP. Account and access writes use the portal.
This is a development directory, not a full OpenLDAP/Active Directory replacement.
"""
import re
import socketserver
import threading
import time
from app.auth.directory import BASE_DN, authenticate, enabled, entries, user_dn
from app.infrastructure.licensing import LicenseStore


def tlv(tag, payload):
    length = len(payload)
    size = bytes([length]) if length < 128 else bytes([0x80 + (length.bit_length()+7)//8]) + length.to_bytes((length.bit_length()+7)//8,'big')
    return bytes([tag])+size+payload


def number(value, tag=2):
    size = max(1,(value.bit_length()+8)//8)
    return tlv(tag,value.to_bytes(size,'big'))


def octet(value, tag=4):
    return tlv(tag,value.encode() if isinstance(value,str) else value)


def parse(data):
    nodes, index = [], 0
    while index < len(data):
        if index+2 > len(data): raise ValueError('Truncated BER')
        tag, length = data[index:index+2];index+=2
        if length & 128:
            width=length & 127
            if not 1<=width<=4 or index+width>len(data): raise ValueError('Invalid BER length')
            length=int.from_bytes(data[index:index+width],'big');index+=width
        if index+length>len(data): raise ValueError('Truncated BER value')
        nodes.append((tag,data[index:index+length]));index+=length
    return nodes


def message(msg_id, operation):
    return tlv(0x30,number(msg_id)+operation)


def result(msg_id, tag, code=0, diagnostic='', extra=b''):
    return message(msg_id,tlv(tag,number(code,10)+octet('')+octet(diagnostic)+extra))


def dn_key(dn):
    return ','.join(part.strip().casefold() for part in dn.split(','))


def matches(node, attrs, depth=0):
    if depth>20: raise ValueError('Filter nesting limit')
    tag,value=node
    lookup={key.casefold():[v.casefold() for v in values] for key,values in attrs.items()}
    if tag==0x87: return value.decode().casefold() in lookup
    if tag in (0xa0,0xa1,0xa2):
        children=parse(value)
        if tag==0xa2:
            if len(children)!=1: raise ValueError('Invalid NOT filter')
            return not matches(children[0],attrs,depth+1)
        flags=[matches(child,attrs,depth+1) for child in children]
        return all(flags) if tag==0xa0 else any(flags)
    if tag==0xa3:
        children=parse(value)
        if len(children)!=2: raise ValueError('Invalid equality filter')
        return children[1][1].decode().casefold() in lookup.get(children[0][1].decode().casefold(),[])
    if tag==0xa4:
        children=parse(value)
        if len(children)!=2: raise ValueError('Invalid substring filter')
        pattern=''
        pieces=parse(children[1][1])
        for kind,part in pieces:
            if kind not in (0x80,0x81,0x82): raise ValueError('Invalid substring')
            if kind==0x80: pattern+='^'+re.escape(part.decode().casefold())
            elif kind==0x81: pattern+='.*'+re.escape(part.decode().casefold())
            else: pattern+='.*'+re.escape(part.decode().casefold())+'$'
        return any(re.search(pattern,v) is not None for v in lookup.get(children[0][1].decode().casefold(),[]))
    raise ValueError('Unsupported LDAP filter')


class LDAPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address=True
    daemon_threads=True
    def __init__(self,address,store,tls_context=None,license_store=None):
        self.store=store
        self.license_store=license_store or LicenseStore()
        self.attempts={}
        self.attempt_lock=threading.Lock()
        super().__init__(address,LDAPHandler)
        if tls_context:
            self.socket=tls_context.wrap_socket(self.socket,server_side=True)


class LDAPHandler(socketserver.BaseRequestHandler):
    def read_exact(self,length):
        data=b''
        while len(data)<length:
            chunk=self.request.recv(length-len(data))
            if not chunk: raise EOFError()
            data+=chunk
        return data

    def handle(self):
        self.request.settimeout(10)
        self.bound_id=None
        try:
            while True:
                header=self.read_exact(2)
                if header[0]!=0x30: return
                size=header[1]
                if size & 128:
                    width=size & 127
                    if not 1<=width<=3: return
                    size=int.from_bytes(self.read_exact(width),'big')
                if size>65536: return
                nodes=parse(self.read_exact(size))
                if len(nodes)<2 or nodes[0][0]!=2: return
                msg_id=int.from_bytes(nodes[0][1],'big')
                operation,value=nodes[1]
                if operation==0x42: return
                # Unknown critical controls must be rejected, never silently applied.
                critical=False
                for tag,controls in nodes[2:]:
                    if tag==0xa0:
                        for _,control in parse(controls):
                            if any(kind==1 and flag!=b'\x00' for kind,flag in parse(control)):
                                critical=True
                if critical:
                    self.request.sendall(result(msg_id,0x65 if operation==0x63 else 0x61 if operation==0x60 else 0x78,12,'Critical controls are not supported.'))
                    continue
                if operation==0x60: self.bind(msg_id,value)
                elif operation==0x63: self.search(msg_id,value)
                elif operation==0x77: self.extended(msg_id,value)
                elif operation==0x50: continue  # Searches are synchronous; nothing remains to abandon.
                else:
                    tags={0x66:0x67,0x68:0x69,0x4a:0x6b,0x6c:0x6d,0x6e:0x6f}
                    self.request.sendall(result(msg_id,tags.get(operation,0x78),53,'Directory is read-only. Manage accounts in the portal.'))
        except (EOFError,OSError,ValueError,UnicodeError,IndexError):
            return

    def actor(self,data):
        return next((u for u in data['users'] if u['id']==self.bound_id and enabled(u)),None)

    def bind(self,msg_id,value):
        self.bound_id=None  # A failed rebind must remove prior authorization.
        fields=parse(value)
        if len(fields)!=3 or fields[0][0]!=2 or fields[1][0]!=4:
            self.request.sendall(result(msg_id,0x61,2,'Invalid bind request.'));return
        if int.from_bytes(fields[0][1],'big')!=3 or fields[2][0]!=0x80:
            self.request.sendall(result(msg_id,0x61,7,'Only LDAPv3 simple bind is supported.'));return
        identity,password=fields[1][1].decode(),fields[2][1].decode()
        if not identity and not password:
            self.request.sendall(result(msg_id,0x61));return
        with self.server.attempt_lock:
            ip=self.client_address[0]
            recent=[t for t in self.server.attempts.get(ip,[]) if t>time.time()-60]
            self.server.attempts[ip]=recent
            if len(recent)>=20:
                self.request.sendall(result(msg_id,0x61,51,'Bind rate limit reached.'));return
            recent.append(time.time())
        with self.server.store.transaction() as data:
            user=authenticate(data['users'],identity,password)
            if user: self.bound_id=user['id']
        self.request.sendall(result(msg_id,0x61,0 if self.bound_id else 49,'' if self.bound_id else 'Invalid credentials or account access is not approved.'))

    def search(self,msg_id,value):
        if not self.server.license_store.status()['usable']:
            self.request.sendall(result(msg_id,0x65,53,'Software licence unavailable or expired. Only authentication is enabled.'));return
        fields=parse(value)
        if len(fields)!=8: raise ValueError('Invalid search')
        base=dn_key(fields[0][1].decode());scope=int.from_bytes(fields[1][1],'big')
        size_limit=int.from_bytes(fields[3][1],'big')
        types_only=fields[5][1]!=b'\x00'
        wanted=[v.decode().casefold() for _,v in parse(fields[7][1])]
        if scope not in (0,1,2):
            self.request.sendall(result(msg_id,0x65,2,'Invalid search scope.'));return
        with self.server.store.transaction() as data:
            actor=self.actor(data)
            if actor is None and not (base=='' and scope==0):
                self.request.sendall(result(msg_id,0x65,50,'Bind with an approved account first.'));return
            rows=entries(data['users'],actor)
        if base not in {dn_key(dn) for dn,_ in rows}:
            self.request.sendall(result(msg_id,0x65,32,'Search base is unavailable.'));return
        count=0
        for dn,attrs in rows:
            normalized=dn_key(dn)
            in_scope=(normalized==base if scope==0 else normalized!=base and normalized.partition(',')[2]==base if scope==1 else normalized==base or bool(base and normalized.endswith(','+base)))
            if not in_scope: continue
            try:
                if not matches(fields[6],attrs): continue
            except ValueError:
                self.request.sendall(result(msg_id,0x65,18,'Unsupported or invalid search filter.'));return
            if size_limit and count>=size_limit:
                self.request.sendall(result(msg_id,0x65,4,'Search size limit exceeded.'));return
            selected={k:v for k,v in attrs.items() if not wanted or '*' in wanted or k.casefold() in wanted}
            if wanted==['1.1']: selected={}
            encoded=b''.join(tlv(0x30,octet(k)+tlv(0x31,b'' if types_only else b''.join(octet(v) for v in values))) for k,values in selected.items())
            self.request.sendall(message(msg_id,tlv(0x64,octet(dn)+tlv(0x30,encoded))))
            count+=1
        self.request.sendall(result(msg_id,0x65))

    def extended(self,msg_id,value):
        fields=parse(value)
        oid=next((v.decode() for tag,v in fields if tag==0x80),'')
        if oid!='1.3.6.1.4.1.4203.1.11.3':
            self.request.sendall(result(msg_id,0x78,53,'Unsupported extension. Use LDAPS with a configured certificate for TLS.'));return
        with self.server.store.transaction() as data:
            actor=self.actor(data)
            authz='dn:'+user_dn(actor) if actor else ''
        self.request.sendall(result(msg_id,0x78,extra=octet(authz,0x8b)))
