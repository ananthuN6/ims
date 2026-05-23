// frontend/src/pages/Admin.jsx
/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { useApp, useCurrentUser } from '../context/AppContext';
import { api } from '../utils/api';
import { Card, Button, Input, Select, FormField, Toast, EmptyState, Spinner } from '../components/ui';
import { Users, UserPlus, Pencil, Trash2, ShieldCheck, User } from 'lucide-react';

const ROLE_LABELS = { iso:'ISO Team', employee:'Employee' };
const ROLE_COLORS = { iso:'var(--accent-cyan)', employee:'var(--text-secondary)' };

function UserRow({ user, onEdit, onDelete, currentUserId }) {
  const isSelf = user.id === currentUserId;
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 200px 110px 110px 90px', alignItems:'center', gap:16, padding:'14px 18px', borderBottom:'1px solid var(--border)', transition:'background var(--transition)' }}
      onMouseEnter={e => e.currentTarget.style.background='var(--bg-card-hover)'}
      onMouseLeave={e => e.currentTarget.style.background='transparent'}
    >
      <div>
        <div style={{ fontSize:14, fontWeight:500, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:8 }}>
          {user.name}
          {user.isAdmin && <span style={{ fontSize:10, background:'rgba(245,158,11,.15)', color:'#fbbf24', border:'1px solid rgba(245,158,11,.3)', borderRadius:999, padding:'1px 7px', fontWeight:600 }}>ADMIN</span>}
          {isSelf && <span style={{ fontSize:10, background:'rgba(59,130,246,.15)', color:'#60a5fa', borderRadius:999, padding:'1px 7px', fontWeight:600 }}>YOU</span>}
        </div>
        <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{user.email}</div>
      </div>
      <span style={{ fontSize:13, color: ROLE_COLORS[user.role] || 'var(--text-secondary)' }}>{ROLE_LABELS[user.role] || user.role}</span>
      <span style={{ fontSize:12, color:'var(--text-muted)' }}>{user.createdAt?.slice(0,10) || '—'}</span>
      <div style={{ display:'flex', gap:8 }}>
        {!user.isAdmin && (
          <>
            <button onClick={() => onEdit(user)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary)', padding:4, borderRadius:4, display:'flex' }} title="Edit">
              <Pencil size={14} />
            </button>
            <button onClick={() => onDelete(user)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent-rose)', padding:4, borderRadius:4, display:'flex' }} title="Delete">
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const EMPTY_FORM = { name:'', email:'', role:'employee' };

export default function Admin() {
  const { state, loadUsers } = useApp();
  const user = useCurrentUser();
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null); // user being edited
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const showToast = (message, type='success') => setToast({ message, type });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit   = (u) => { setEditing(u); setForm({ name:u.name, email:u.email, role:u.role }); setShowForm(true); };
  const closeForm  = () => { setShowForm(false); setEditing(null); setForm(EMPTY_FORM); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.role) { showToast('All fields required', 'error'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.updateUser(editing.id, form);
        showToast(`${form.name} updated successfully`);
      } else {
        await api.createUser(form);
        showToast(`${form.name} added to IMS`);
      }
      closeForm();
      fetchUsers();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteUser(deleteTarget.id);
      showToast(`${deleteTarget.name} removed from IMS`);
      setDeleteTarget(null);
      fetchUsers();
    } catch (e) { showToast(e.message, 'error'); }
  };

  const isoCount = users.filter(u => u.role === 'iso').length;
  const empCount = users.filter(u => u.role === 'employee').length;

  return (
    <div className="animate-fade-up">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Confirm delete modal */}
      {deleteTarget && (
        <div style={{ position:'fixed', inset:0, zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.6)' }}>
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:28, maxWidth:380, width:'90%', boxShadow:'var(--shadow-lg)' }}>
            <h3 style={{ fontWeight:700, marginBottom:8, color:'var(--text-primary)' }}>Remove User</h3>
            <p style={{ fontSize:14, color:'var(--text-secondary)', marginBottom:24 }}>
              Are you sure you want to remove <strong>{deleteTarget.name}</strong> ({deleteTarget.email}) from IMS? They will lose access immediately.
            </p>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="danger" onClick={handleDelete}>Remove User</Button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28, flexWrap:'wrap', gap:16 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.02em', display:'flex', alignItems:'center', gap:10 }}>
            <Users size={20} color="var(--accent-blue)" /> User Administration
          </h1>
          <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>
            Manage who can access the IMS system. Users log in with their Microsoft accounts.
          </p>
        </div>
        <Button onClick={openCreate} icon={<UserPlus size={15} />}>Add User</Button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:16, marginBottom:24 }}>
        {[
          { label:'Total Users', value:users.length, color:'#3b82f6' },
          { label:'ISO Team',    value:isoCount,      color:'#06b6d4' },
          { label:'Employees',   value:empCount,      color:'#8b5cf6' },
        ].map(s => (
          <Card key={s.label} style={{ padding:'16px 20px' }}>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:8, fontWeight:500 }}>{s.label}</div>
            <div style={{ fontSize:28, fontWeight:700, color:s.color }}>{s.value}</div>
          </Card>
        ))}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <Card style={{ marginBottom:24, border:'1px solid rgba(59,130,246,.25)' }}>
          <h3 style={{ fontWeight:600, fontSize:15, marginBottom:16 }}>
            {editing ? `Edit: ${editing.name}` : '➕ Add New User'}
          </h3>
          <form onSubmit={handleSave}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 160px', gap:16, marginBottom:16 }}>
              <FormField label="Full Name" required>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name:e.target.value }))} placeholder="Jane Smith" />
              </FormField>
              <FormField label="Organisation Email" required>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email:e.target.value }))} placeholder="jane@company.com" />
              </FormField>
              <FormField label="Role" required>
                <Select value={form.role} onChange={e => setForm(f => ({ ...f, role:e.target.value }))}>
                  <option value="employee">Employee</option>
                  <option value="iso">ISO Team</option>
                </Select>
              </FormField>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add User'}</Button>
              <Button type="button" variant="secondary" onClick={closeForm}>Cancel</Button>
            </div>
          </form>
          <p style={{ marginTop:12, fontSize:12, color:'var(--text-muted)' }}>
            ℹ️ The user's Microsoft account UPN must exactly match the email entered here.
          </p>
        </Card>
      )}

      {/* Table */}
      <Card style={{ padding:0, overflow:'hidden' }}>
        {/* Header */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 200px 110px 110px 90px', gap:16, padding:'12px 18px', borderBottom:'1px solid var(--border)', background:'var(--bg-secondary)' }}>
          {['Name / Email','Role','Added','',''].map((h,i) => (
            <span key={i} style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', letterSpacing:'0.05em' }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding:48, display:'flex', justifyContent:'center' }}><Spinner size={28} /></div>
        ) : users.length === 0 ? (
          <EmptyState icon="👤" title="No users yet" message="Add users so they can log in with their Microsoft accounts." />
        ) : (
          users.map(u => <UserRow key={u.id} user={u} onEdit={openEdit} onDelete={setDeleteTarget} currentUserId={user?.id} />)
        )}
      </Card>
    </div>
  );
}
