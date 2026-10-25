"""Shared file-directory authentication for the portal and local LDAP listener."""
from app.models.store import verify_password
BASE_DN = 'dc=supplylink,dc=local'


def user_dn(user):
    return 'uid=' + user['id'] + ',ou=people,' + BASE_DN


def enabled(user):
    return user.get('active', False) and user.get('approval_status', 'approved') == 'approved'


def authenticate(users, identifier, password):
    if not isinstance(identifier, str) or not isinstance(password, str) or not password or len(password)>128:
        return None
    normalized = ','.join(part.strip() for part in identifier.strip().lower().split(','))
    user = next((u for u in users if u['email'].lower()==normalized or user_dn(u).lower()==normalized), None)
    if not user or not enabled(user) or not verify_password(password, user['password']):
        return None
    return user


def entries(users, actor):
    rows = [('', {'objectClass':['top'], 'namingContexts':[BASE_DN], 'supportedLDAPVersion':['3'], 'supportedExtension':['1.3.6.1.4.1.4203.1.11.3']})]
    if actor is None:
        return rows
    rows += [(BASE_DN, {'objectClass':['top','domain'],'dc':['supplylink']}),
             ('ou=people,'+BASE_DN, {'objectClass':['top','organizationalUnit'],'ou':['people']}),
             ('ou=groups,'+BASE_DN, {'objectClass':['top','organizationalUnit'],'ou':['groups']})]
    visible = users if actor['role']=='admin' else [u for u in users if u['id']==actor['id']]
    for user in visible:
        rows.append((user_dn(user),dict(objectClass=['top','person','organizationalPerson','inetOrgPerson'],uid=[user['id']],cn=[user['name']],sn=[user['name'].split()[-1]],mail=[user['email']],title=[user['role']],employeeType=[user.get('approval_status','approved')],description=[user['business']],accountStatus=['active' if enabled(user) else 'disabled'])))
    for role in ('admin','distributor','retailer','delivery'):
        if actor['role']!='admin' and role!=actor['role']:
            continue
        members = [user_dn(u) for u in users if u['role']==role and enabled(u)]
        if members:
            # Non-admins see only their own membership, never other users' DNs.
            if actor['role']!='admin': members=[user_dn(actor)]
            rows.append(('cn='+role+',ou=groups,'+BASE_DN,{'objectClass':['top','groupOfNames'],'cn':[role],'member':members}))
    return rows
