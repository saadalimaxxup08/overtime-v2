import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabaseClient'
import { Save, User, Clock } from 'lucide-react'

export default function Dashboard({ user }) {
  const [profile, setProfile] = useState({ full_name: '', employee_id: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // useCallback lagaya taake function re-create na ho
  const fetchProfile = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
       .from('user_profiles')
       .select('*')
       .eq('user_id', user.id)
       .maybeSingle()

      if (data) {
        setProfile({
          full_name: data.full_name || '',
          employee_id: data.employee_id || ''
        })
      }
    } catch (err) {
      console.log('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [user.id]) // <-- Sirf user.id dependency

  // Sirf 1 baar chalega
  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase.from('user_profiles').upsert({
      user_id: user.id,
      email: user.email,
      full_name: profile.full_name,
      employee_id: profile.employee_id
    })

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('Details saved successfully!')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="glass rounded-3xl p-6">
        <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-cyan-400" />
          Employee Details
        </h2>

        <div className="space-y-4">
          <div>
            <label className="text-slate-400 text-sm font-bold">Full Name</label>
            <input
              type="text"
              value={profile.full_name}
              onChange={(e) => setProfile(prev => ({...prev, full_name: e.target.value }))}
              className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100"
              placeholder="Apna naam likho"
            />
          </div>

          <div>
            <label className="text-slate-400 text-sm font-bold">Employee ID</label>
            <input
              type="text"
              value={profile.employee_id}
              onChange={(e) => setProfile(prev => ({...prev, employee_id: e.target.value }))}
              className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100"
              placeholder="EMP-001"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving? 'Saving...' : 'Save Details'}
          </button>
        </div>
      </div>
    </div>
  )
}
