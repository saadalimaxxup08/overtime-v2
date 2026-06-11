<<<<<<< HEAD
import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Users, Activity, Trash2, Shield, RefreshCw, AlertCircle, Eye, Calendar, Clock } from 'lucide-react'

export default function AdminDashboard({ user }) {
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState({ totalUsers: 0, totalOvertime: 0, activeToday: 0 })
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState('users') // 'users', 'activity', 'overtime'
  const [error, setError] = useState('')
  const [allOvertime, setAllOvertime] = useState([])

  useEffect(() => {
    checkAdminAccess()
  }, [])

  const checkAdminAccess = async () => {
    const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

    if (profile?.role!== 'admin') {
      setError('Access Denied. Admin only.')
      setLoading(false)
      return
    }

    fetchAllData()
  }

  const fetchAllData = async () => {
    setLoading(true)
    try {
      // 1. Fetch all users
      const { data: usersData, error: usersError } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })

      if (usersError) throw usersError
      setUsers(usersData || [])

      // 2. Fetch activity logs
      const { data: logsData, error: logsError } = await supabase
      .from('activity_logs')
      .select('*, user_profiles(full_name, username)')
      .order('created_at', { ascending: false })
      .limit(100)

      if (logsError) throw logsError
      setLogs(logsData || [])

      // 3. Fetch all overtime
      const { data: overtimeData, error: overtimeError } = await supabase
      .from('overtime_logs')
      .select('*, user_profiles(full_name, username, employee_id)')
      .order('date', { ascending: false })

      if (overtimeError) throw overtimeError
      setAllOvertime(overtimeData || [])

      // 4. Calculate stats
      const totalOvertimeMins = overtimeData?.reduce((sum, log) => sum + (log.duration_minutes || 0), 0) || 0
      const today = new Date().toISOString().split('T')[0]
      const activeToday = logsData?.filter(log => log.created_at.startsWith(today)).length || 0

      setStats({
        totalUsers: usersData?.length || 0,
        totalOvertime: Math.floor(totalOvertimeMins / 60),
        activeToday
      })

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to delete user: ${userName}? This will delete all their data.`)) return

    try {
      // 1. Delete from auth.users - cascade will delete profiles, logs, overtime
      const { error } = await supabase.auth.admin.deleteUser(userId)

      if (error) throw error

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'admin_delete_user',
        details: { deleted_user_id: userId, deleted_user_name: userName }
      })

      alert('User deleted successfully')
      fetchAllData()
    } catch (err) {
      alert('Failed to delete user: ' + err.message)
    }
  }

  const handleDeleteOvertime = async (overtimeId) => {
    if (!confirm('Delete this overtime entry?')) return

    try {
      const { error } = await supabase
      .from('overtime_logs')
      .delete()
      .eq('id', overtimeId)

      if (error) throw error

      alert('Overtime deleted')
      fetchAllData()
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    }
  }

  const formatMinutes = (minutes) => {
    const hrs = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hrs}h ${mins}m`
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="glass rounded-3xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Access Denied</h2>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="glass rounded-3xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-emerald-400" />
            <h1 className="text-3xl font-black text-slate-100">Admin Dashboard</h1>
          </div>
          <p className="text-slate-400 text-sm">Full system control and monitoring</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase">Total Users</p>
                <p className="text-4xl font-black text-emerald-400 mt-2">{stats.totalUsers}</p>
              </div>
              <Users className="w-12 h-12 text-emerald-500/30" />
            </div>
          </div>

          <div className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase">Total Overtime</p>
                <p className="text-4xl font-black text-cyan-400 mt-2">{stats.totalOvertime}h</p>
              </div>
              <Clock className="w-12 h-12 text-cyan-500/30" />
            </div>
          </div>

          <div className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase">Active Today</p>
                <p className="text-4xl font-black text-purple-400 mt-2">{stats.activeToday}</p>
              </div>
              <Activity className="w-12 h-12 text-purple-500/30" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="glass rounded-3xl p-2">
          <div className="flex gap-2">
            {['users', 'activity', 'overtime'].map(tab => (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab)}
                className={`flex-1 py-3 rounded-xl font-bold transition ${
                  selectedTab === tab
                  ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Users Tab */}
        {selectedTab === 'users' && (
          <div className="glass rounded-3xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              All Users ({users.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                    <th className="pb-3 font-bold">Name</th>
                    <th className="pb-3 font-bold">Username</th>
                    <th className="pb-3 font-bold">Employee ID</th>
                    <th className="pb-3 font-bold">Role</th>
                    <th className="pb-3 font-bold">Joined</th>
                    <th className="pb-3 font-bold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-900/30">
                      <td className="py-3.5 font-semibold text-slate-100">{u.full_name || '-'}</td>
                      <td className="text-slate-400">{u.username || '-'}</td>
                      <td className="text-slate-400">{u.employee_id || '-'}</td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          u.role === 'admin'
                          ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-700 text-slate-300'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="text-slate-500 text-xs">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="text-center">
                        {u.role!== 'admin' && (
                          <button
                            onClick={() => handleDeleteUser(u.user_id, u.full_name)}
                            className="text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {selectedTab === 'activity' && (
          <div className="glass rounded-3xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Recent Activity (Last 100)
            </h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-slate-100 font-semibold">
                        {log.user_profiles?.full_name || log.user_profiles?.username || 'Unknown User'}
                      </p>
                      <p className="text-emerald-400 text-sm font-bold">{log.action}</p>
                      {log.details && (
                        <pre className="text-slate-500 text-xs mt-1">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                    <span className="text-slate-600 text-xs">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Overtime Tab */}
        {selectedTab === 'overtime' && (
          <div className="glass rounded-3xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-400" />
              All Overtime Records
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                    <th className="pb-3 font-bold">User</th>
                    <th className="pb-3 font-bold">Date</th>
                    <th className="pb-3 font-bold">Duration</th>
                    <th className="pb-3 font-bold">Description</th>
                    <th className="pb-3 font-bold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {allOvertime.map(ot => (
                    <tr key={ot.id} className="hover:bg-slate-900/30">
                      <td className="py-3.5 font-semibold text-slate-100">
                        {ot.user_profiles?.full_name || ot.user_profiles?.username}
                      </td>
                      <td className="text-slate-400">{ot.date}</td>
                      <td className="text-emerald-400 font-bold">{formatMinutes(ot.duration_minutes)}</td>
                      <td className="text-slate-500 text-xs max-w-[200px] truncate">{ot.description}</td>
                      <td className="text-center">
                        <button
                          onClick={() => handleDeleteOvertime(ot.id)}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
=======
import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Users, Activity, Trash2, Shield, RefreshCw, AlertCircle, Eye, Calendar, Clock } from 'lucide-react'

export default function AdminDashboard({ user }) {
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState({ totalUsers: 0, totalOvertime: 0, activeToday: 0 })
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState('users') // 'users', 'activity', 'overtime'
  const [error, setError] = useState('')
  const [allOvertime, setAllOvertime] = useState([])

  useEffect(() => {
    checkAdminAccess()
  }, [])

  const checkAdminAccess = async () => {
    const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

    if (profile?.role!== 'admin') {
      setError('Access Denied. Admin only.')
      setLoading(false)
      return
    }

    fetchAllData()
  }

  const fetchAllData = async () => {
    setLoading(true)
    try {
      // 1. Fetch all users
      const { data: usersData, error: usersError } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })

      if (usersError) throw usersError
      setUsers(usersData || [])

      // 2. Fetch activity logs
      const { data: logsData, error: logsError } = await supabase
      .from('activity_logs')
      .select('*, user_profiles(full_name, username)')
      .order('created_at', { ascending: false })
      .limit(100)

      if (logsError) throw logsError
      setLogs(logsData || [])

      // 3. Fetch all overtime
      const { data: overtimeData, error: overtimeError } = await supabase
      .from('overtime_logs')
      .select('*, user_profiles(full_name, username, employee_id)')
      .order('date', { ascending: false })

      if (overtimeError) throw overtimeError
      setAllOvertime(overtimeData || [])

      // 4. Calculate stats
      const totalOvertimeMins = overtimeData?.reduce((sum, log) => sum + (log.duration_minutes || 0), 0) || 0
      const today = new Date().toISOString().split('T')[0]
      const activeToday = logsData?.filter(log => log.created_at.startsWith(today)).length || 0

      setStats({
        totalUsers: usersData?.length || 0,
        totalOvertime: Math.floor(totalOvertimeMins / 60),
        activeToday
      })

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to delete user: ${userName}? This will delete all their data.`)) return

    try {
      // 1. Delete from auth.users - cascade will delete profiles, logs, overtime
      const { error } = await supabase.auth.admin.deleteUser(userId)

      if (error) throw error

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'admin_delete_user',
        details: { deleted_user_id: userId, deleted_user_name: userName }
      })

      alert('User deleted successfully')
      fetchAllData()
    } catch (err) {
      alert('Failed to delete user: ' + err.message)
    }
  }

  const handleDeleteOvertime = async (overtimeId) => {
    if (!confirm('Delete this overtime entry?')) return

    try {
      const { error } = await supabase
      .from('overtime_logs')
      .delete()
      .eq('id', overtimeId)

      if (error) throw error

      alert('Overtime deleted')
      fetchAllData()
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    }
  }

  const formatMinutes = (minutes) => {
    const hrs = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hrs}h ${mins}m`
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="glass rounded-3xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Access Denied</h2>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="glass rounded-3xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-emerald-400" />
            <h1 className="text-3xl font-black text-slate-100">Admin Dashboard</h1>
          </div>
          <p className="text-slate-400 text-sm">Full system control and monitoring</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase">Total Users</p>
                <p className="text-4xl font-black text-emerald-400 mt-2">{stats.totalUsers}</p>
              </div>
              <Users className="w-12 h-12 text-emerald-500/30" />
            </div>
          </div>

          <div className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase">Total Overtime</p>
                <p className="text-4xl font-black text-cyan-400 mt-2">{stats.totalOvertime}h</p>
              </div>
              <Clock className="w-12 h-12 text-cyan-500/30" />
            </div>
          </div>

          <div className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase">Active Today</p>
                <p className="text-4xl font-black text-purple-400 mt-2">{stats.activeToday}</p>
              </div>
              <Activity className="w-12 h-12 text-purple-500/30" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="glass rounded-3xl p-2">
          <div className="flex gap-2">
            {['users', 'activity', 'overtime'].map(tab => (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab)}
                className={`flex-1 py-3 rounded-xl font-bold transition ${
                  selectedTab === tab
                  ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Users Tab */}
        {selectedTab === 'users' && (
          <div className="glass rounded-3xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              All Users ({users.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                    <th className="pb-3 font-bold">Name</th>
                    <th className="pb-3 font-bold">Username</th>
                    <th className="pb-3 font-bold">Employee ID</th>
                    <th className="pb-3 font-bold">Role</th>
                    <th className="pb-3 font-bold">Joined</th>
                    <th className="pb-3 font-bold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-900/30">
                      <td className="py-3.5 font-semibold text-slate-100">{u.full_name || '-'}</td>
                      <td className="text-slate-400">{u.username || '-'}</td>
                      <td className="text-slate-400">{u.employee_id || '-'}</td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          u.role === 'admin'
                          ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-700 text-slate-300'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="text-slate-500 text-xs">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="text-center">
                        {u.role!== 'admin' && (
                          <button
                            onClick={() => handleDeleteUser(u.user_id, u.full_name)}
                            className="text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {selectedTab === 'activity' && (
          <div className="glass rounded-3xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Recent Activity (Last 100)
            </h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-slate-100 font-semibold">
                        {log.user_profiles?.full_name || log.user_profiles?.username || 'Unknown User'}
                      </p>
                      <p className="text-emerald-400 text-sm font-bold">{log.action}</p>
                      {log.details && (
                        <pre className="text-slate-500 text-xs mt-1">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                    <span className="text-slate-600 text-xs">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Overtime Tab */}
        {selectedTab === 'overtime' && (
          <div className="glass rounded-3xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-400" />
              All Overtime Records
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                    <th className="pb-3 font-bold">User</th>
                    <th className="pb-3 font-bold">Date</th>
                    <th className="pb-3 font-bold">Duration</th>
                    <th className="pb-3 font-bold">Description</th>
                    <th className="pb-3 font-bold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {allOvertime.map(ot => (
                    <tr key={ot.id} className="hover:bg-slate-900/30">
                      <td className="py-3.5 font-semibold text-slate-100">
                        {ot.user_profiles?.full_name || ot.user_profiles?.username}
                      </td>
                      <td className="text-slate-400">{ot.date}</td>
                      <td className="text-emerald-400 font-bold">{formatMinutes(ot.duration_minutes)}</td>
                      <td className="text-slate-500 text-xs max-w-[200px] truncate">{ot.description}</td>
                      <td className="text-center">
                        <button
                          onClick={() => handleDeleteOvertime(ot.id)}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
>>>>>>> f53560b (fix)
}