import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { FileText, Download, Calendar, Clock, AlertCircle, RefreshCw, User, Save, CheckCircle, Edit2, X, Plus, Trash2 } from 'lucide-react'

export default function Report({ user }) {
  const [selectedMonth, setSelectedMonth] = useState('')
  const [reportLogs, setReportLogs] = useState([])
  const [totalMinutes, setTotalMinutes] = useState(0)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Profile states
  const [fullName, setFullName] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)

  // Edit/Add states
  const [editingId, setEditingId] = useState(null)
  const [editTimes, setEditTimes] = useState({ check_in_time: '', check_out_time: '', description: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    setSelectedMonth(`${yyyy}-${mm}`)
    fetchUserProfile()
  }, )

  useEffect(() => {
    if (selectedMonth && user) {
      fetchReportData()
    }
  }, [selectedMonth, user])

  const fetchUserProfile = async () => {
    if (!user?.id) {
      setProfileLoading(false)
      return
    }
    setProfileLoading(true)
    try {
      const { data, error } = await supabase
      .from('user_profiles')
      .select('full_name, employee_id')
      .eq('user_id', user.id)
      .maybeSingle()

      if (error) throw error

      if (data) {
        setFullName(data.full_name || '')
        setEmployeeId(data.employee_id || '')
      } else {
        setFullName('')
        setEmployeeId('')
      }
    } catch (err) {
      console.error('Profile fetch error:', err)
      setErrorMsg(`Failed to load profile: ${err.message}`)
      setTimeout(() => setErrorMsg(''), 4000)
    } finally {
      setProfileLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!fullName.trim() ||!employeeId.trim()) {
      setErrorMsg('Full Name and Employee ID are required')
      setTimeout(() => setErrorMsg(''), 3000)
      return
    }

    setSavingProfile(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const { error } = await supabase
      .from('user_profiles')
      .upsert({
          user_id: user.id,
          full_name: fullName.trim(),
          employee_id: employeeId.trim(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })

      if (error) throw error

      setSuccessMsg('Profile saved successfully')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      console.error('Save error:', err)
      setErrorMsg(`Failed to save profile: ${err.message}`)
      setTimeout(() => setErrorMsg(''), 4000)
    } finally {
      setSavingProfile(false)
    }
  }

  const fetchReportData = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const [yearStr, monthStr] = selectedMonth.split('-')
      const year = parseInt(yearStr, 10)
      const month = parseInt(monthStr, 10)

      const start = `${yearStr}-${monthStr}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const end = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`

      const { data, error } = await supabase
      .from('overtime_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })

      if (error) throw error

      const logsByDate = {}
      data?.forEach((log) => {
        if (!logsByDate[log.date]) {
          logsByDate[log.date] = []
        }
        logsByDate[log.date].push(log)
      })

      const fullMonthLogs = []
      let totalMins = 0

      for (let day = 1; day <= lastDay; day++) {
        const dateStr = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`

        if (logsByDate[dateStr]) {
          logsByDate[dateStr].forEach((log) => {
            fullMonthLogs.push({
            ...log,
              isPadded: false,
            })
            totalMins += log.duration_minutes || 0
          })
        } else {
          fullMonthLogs.push({
            id: `report-padded-${dateStr}`,
            date: dateStr,
            check_in_time: null,
            check_out_time: null,
            duration_minutes: 0,
            description: 'No overtime logged',
            isPadded: true,
          })
        }
      }

      setReportLogs(fullMonthLogs)
      setTotalMinutes(totalMins)
    } catch (err) {
      console.error(err)
      setErrorMsg('Failed to generate report previews. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  const formatMinutes = (minutes) => {
    if (!minutes) return '0h 0m'
    const hrs = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hrs}h ${mins}m`
  }

  const formatTimeForDisplay = (timeStr) => {
    if (!timeStr) return '--'
    if (typeof timeStr === 'string' && (timeStr.includes('T') || timeStr.includes('+'))) {
      try {
        const date = new Date(timeStr)
        return date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })
      } catch {
        return '--'
      }
    }
    return timeStr
  }

  const startEdit = (log) => {
    setEditingId(log.id)
    // ✅ Fix: Agar timestamp hai to sirf time nikal
    const getTimeFromTimestamp = (ts) => {
      if (!ts) return '18:00'
      if (ts.includes('T')) return ts.split('T')[1].substring(0, 5)
      return ts
    }

    setEditTimes({
      check_in_time: getTimeFromTimestamp(log.check_in_time),
      check_out_time: getTimeFromTimestamp(log.check_out_time),
      description: log.description === 'No overtime logged'? '' : log.description || ''
    })
    setErrorMsg('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditTimes({ check_in_time: '', check_out_time: '', description: '' })
  }

  const saveEdit = async () => {
    if (!editTimes.check_in_time ||!editTimes.check_out_time) {
      setErrorMsg('Both Check-In and Check-Out times are required')
      setTimeout(() => setErrorMsg(''), 3000)
      return
    }

    setSavingEdit(true)
    setErrorMsg('')

    try {
      const log = reportLogs.find(l => l.id === editingId)
      const isPadded = log.isPadded

      // ✅ Fix: Timestamp sahi format me banao
      const checkInTimestamp = `${log.date}T${editTimes.check_in_time}:00`
      const checkOutTimestamp = `${log.date}T${editTimes.check_out_time}:00`

      const start = new Date(checkInTimestamp)
      const end = new Date(checkOutTimestamp)

      if (editTimes.check_out_time < editTimes.check_in_time) end.setDate(end.getDate() + 1)

      const diffMs = end - start
      const duration_minutes = Math.round(diffMs / 1000 / 60)

      if (duration_minutes < 0) {
        setErrorMsg('Check-Out time must be after Check-In time')
        setTimeout(() => setErrorMsg(''), 3000)
        setSavingEdit(false)
        return
      }

      if (isPadded) {
        const { error } = await supabase
        .from('overtime_logs')
        .insert({
            user_id: user.id,
            date: log.date,
            check_in_time: checkInTimestamp,
            check_out_time: checkOutTimestamp,
            duration_minutes: duration_minutes,
            description: editTimes.description || 'Manual entry'
          })

        if (error) throw error
        setSuccessMsg('Time added successfully')
      } else {
        const { error } = await supabase
        .from('overtime_logs')
        .update({
            check_in_time: checkInTimestamp,
            check_out_time: checkOutTimestamp,
            duration_minutes: duration_minutes,
            description: editTimes.description || log.description
          })
        .eq('id', editingId)
        .eq('user_id', user.id)

        if (error) throw error
        setSuccessMsg('Time updated successfully')
      }

      setTimeout(() => setSuccessMsg(''), 3000)
      cancelEdit()
      fetchReportData()
    } catch (err) {
      console.error('Save error:', err)
      setErrorMsg(`Failed to save: ${err.message}`)
      setTimeout(() => setErrorMsg(''), 4000)
    } finally {
      setSavingEdit(false)
    }
  }

  // ✅ NAYA: Delete function
  const handleDelete = async (logId) => {
    if (!confirm('Are you sure you want to delete this overtime entry?')) return

    setDeletingId(logId)
    setErrorMsg('')

    try {
      const { error } = await supabase
      .from('overtime_logs')
      .delete()
      .eq('id', logId)
      .eq('user_id', user.id)

      if (error) throw error

      setSuccessMsg('Overtime deleted successfully')
      setTimeout(() => setSuccessMsg(''), 3000)
      fetchReportData()
    } catch (err) {
      console.error('Delete error:', err)
      setErrorMsg(`Failed to delete: ${err.message}`)
      setTimeout(() => setErrorMsg(''), 4000)
    } finally {
      setDeletingId(null)
    }
  }

  const handleDownloadPDF = () => {
    if (!fullName.trim() ||!employeeId.trim()) {
      setErrorMsg('Please save Full Name and Employee ID first')
      setTimeout(() => setErrorMsg(''), 4000)
      return
    }

    try {
      setErrorMsg('')
      const doc = new jsPDF()

      doc.setFillColor(15, 23, 42)
      doc.rect(0, 0, 210, 45, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(22)
      doc.text('OVERTIME TRACKER REPORT', 15, 20)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(16, 185, 129)
      doc.text('VIP SYSTEM VERIFIED DOCUMENT', 15, 27)

      doc.setTextColor(255, 255, 255)
      const [y, m] = selectedMonth.split('-')
      const monthLabel = new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
      doc.text(`Month: ${monthLabel}`, 140, 20)
      doc.text(`Total Duration: ${formatMinutes(totalMinutes)}`, 140, 27)

      doc.setFillColor(16, 185, 129)
      doc.rect(0, 43, 210, 2, 'F')

      doc.setTextColor(51, 65, 85)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text(`Employee Name: ${fullName}`, 15, 53)
      doc.text(`Employee ID: ${employeeId}`, 15, 58)
      doc.setFont('helvetica', 'normal')
      doc.text(`Generated On: ${new Date().toLocaleString()}`, 15, 63)

      const tableRows = reportLogs.map((log) => {
        const dateFormatted = new Date(log.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })

        if (log.isPadded) {
          return [dateFormatted, '--', '--', '--', '--', '--']
        }

        const checkIn = formatTimeForDisplay(log.check_in_time)
        const checkOut = formatTimeForDisplay(log.check_out_time)
        const duration = log.duration_minutes? formatMinutes(log.duration_minutes) : '0h 0m'
        const desc = log.description || '-'

        return [dateFormatted, 'OVERTIME', checkIn, checkOut, duration, desc]
      })

      autoTable(doc, {
        startY: 70,
        head: [['Date', 'Status', 'Check-In', 'Check-Out', 'Duration', 'Task / Description']],
        body: tableRows,
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'left',
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: [30, 41, 59],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          4: { halign: 'right', fontStyle: 'bold' },
          5: { cellWidth: 50 },
        },
        margin: { left: 15, right: 15 },
        theme: 'striped',
      })

      doc.save(`Overtime_Report_${selectedMonth}_${employeeId}.pdf`)
    } catch (err) {
      console.error('PDF Error:', err)
      setErrorMsg(`PDF Error: ${err.message}`)
    }
  }

  const [y, m] = selectedMonth? selectedMonth.split('-') : ['', '']
  const monthName = selectedMonth? new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' }) : ''

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Profile Section */}
      <div className="glass rounded-3xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex items-center gap-3 mb-6">
          <User className="w-6 h-6 text-emerald-400" />
          <h2 className="text-xl font-bold text-slate-100">Employee Details</h2>
          {profileLoading && <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-slate-400 text-xs font-bold uppercase tracking-wider">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ali Khan"
              disabled={profileLoading}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition duration-200 disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-400 text-xs font-bold uppercase tracking-wider">Employee ID</label>
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="EMP-001"
              disabled={profileLoading}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition duration-200 disabled:opacity-50"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile || profileLoading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold py-3 px-6 rounded-xl transition duration-300 border border-emerald-500/30 disabled:opacity-50"
            >
              {savingProfile? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              Save Details
            </button>
          </div>
        </div>

        {successMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {successMsg}
          </div>
        )}
      </div>

      <div className="glass rounded-3xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 flex items-center gap-3">
              <FileText className="w-8 h-8 text-emerald-400" />
              Monthly PDF Reports
            </h1>
            <p className="text-slate-400 mt-2 text-sm max-w-xl">
              Export verified calendar PDF reports containing your daily work logs. This is compatible with HR systems and formats all dates in a contiguous list.
            </p>
          </div>

          <div className="flex flex-col gap-1.5 self-start md:self-auto min-w-[200px]">
            <label className="text-slate-400 text-xs font-bold uppercase tracking-wider">Select Month</label>
            <div className="relative">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 pl-10 text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition duration-200"
              />
              <Calendar className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass rounded-3xl p-6 flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
          <div className="space-y-1">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Overtime ({monthName})</span>
            <div className="text-3xl font-black text-emerald-400 font-mono">
              {formatMinutes(totalMinutes)}
            </div>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
            <Clock className="w-6 h-6 text-emerald-400" />
          </div>
        </div>

        <div className="glass rounded-3xl p-6 flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
          <div className="space-y-1">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Printable PDF document</span>
            <p className="text-xs text-slate-500">Ready to save locally on your phone or PC</p>
          </div>
          <button
            onClick={handleDownloadPDF}
            disabled={loading || reportLogs.length === 0}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold py-3.5 px-6 rounded-2xl transition duration-300 shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 disabled:opacity-50"
          >
            <Download className="w-5 h-5" />
            Download PDF
          </button>
        </div>
      </div>

      <div className="glass rounded-3xl p-6 md:p-8">
        <div className="flex justify-between items-center mb-6 border-b border-slate-900 pb-4">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            Preview: {monthName} Calendar Records
          </h2>
          {loading && <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />}
        </div>

        {loading? (
          <div className="py-20 flex justify-center">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : reportLogs.length === 0? (
          <div className="py-20 text-center text-slate-500 italic text-sm">
            Select a month to load previews.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="pb-3 font-bold">Date</th>
                  <th className="pb-3 font-bold">Status</th>
                  <th className="pb-3 font-bold">Check-In</th>
                  <th className="pb-3 font-bold">Check-Out</th>
                  <th className="pb-3 font-bold text-right">Duration</th>
                  <th className="pb-3 font-bold pl-6">Work Description</th>
                  <th className="pb-3 font-bold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {reportLogs.map((log) => (
                  <tr
                    key={log.id}
                    className={`hover:bg-slate-900/30 transition-colors ${
                      log.isPadded? 'text-slate-600 bg-slate-950/10' : 'text-slate-100'
                    }`}
                  >
                    <td className="py-3.5 font-semibold">
                      {new Date(log.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td>
                      {log.isPadded? (
                        <span className="text-slate-600">--</span>
                      ) : (
                        <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                          OVERTIME
                        </span>
                      )}
                    </td>
                    <td className="font-mono">
                      {editingId === log.id? (
                        <input
                          type="time"
                          value={editTimes.check_in_time}
                          onChange={(e) => setEditTimes({...editTimes, check_in_time: e.target.value})}
                          className="bg-slate-900 border border-emerald-500 rounded px-2 py-1 text-sm w-24"
                        />
                      ) : (
                        formatTimeForDisplay(log.check_in_time)
                      )}
                    </td>
                    <td className="font-mono">
                      {editingId === log.id? (
                        <input
                          type="time"
                          value={editTimes.check_out_time}
                          onChange={(e) => setEditTimes({...editTimes, check_out_time: e.target.value})}
                          className="bg-slate-900 border border-emerald-500 rounded px-2 py-1 text-sm w-24"
                        />
                      ) : (
                        formatTimeForDisplay(log.check_out_time)
                      )}
                    </td>
                    <td className={`font-mono font-bold text-right ${log.duration_minutes > 0? 'text-emerald-400' : 'text-slate-600'}`}>
                      {log.isPadded? '--' : log.duration_minutes? formatMinutes(log.duration_minutes) : '0h 0m'}
                    </td>
                    <td className={`pl-6 max-w-[180px] text-xs ${log.isPadded? 'text-slate-600' : 'text-slate-400'}`}>
                      {editingId === log.id? (
                        <input
                          type="text"
                          value={editTimes.description}
                          onChange={(e) => setEditTimes({...editTimes, description: e.target.value})}
                          placeholder="Task description"
                          className="bg-slate-900 border border-emerald-500 rounded px-2 py-1 text-xs w-full"
                        />
                      ) : (
                        <div className="truncate">{log.isPadded? '--' : log.description || '-'}</div>
                      )}
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        {editingId === log.id? (
                          <>
                            <button
                              onClick={saveEdit}
                              disabled={savingEdit}
                              className="text-emerald-400 hover:text-emerald-300 text-sm font-bold disabled:opacity-50"
                            >
                              {savingEdit? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-slate-500 hover:text-slate-400"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(log)}
                              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                            >
                              {log.isPadded? <Plus className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                              <span className="text-xs">{log.isPadded? 'Add' : 'Edit'}</span>
                            </button>
                            {/* ✅ NAYA: Delete button - sirf real records ke liye */}
                            {!log.isPadded && (
                              <button
                                onClick={() => handleDelete(log.id)}
                                disabled={deletingId === log.id}
                                className="text-rose-400 hover:text-rose-300 disabled:opacity-50"
                              >
                                {deletingId === log.id? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
