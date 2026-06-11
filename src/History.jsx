import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Calendar, Clock, AlertCircle, Info, CalendarDays, Search } from 'lucide-react'

export default function History({ user }) {
  const [dbLogs, setDbLogs] = useState([])
  const [paddedLogs, setPaddedLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [filterType, setFilterType] = useState('all') // 'all', 'overtime', 'no-overtime'
  
  useEffect(() => {
    fetchHistory()
  }, [user])

  const fetchHistory = async () => {
    if (!user) return
    setLoading(true)
    setErrorMsg('')
    try {
      // Fetch all logs of the user sorted by date descending
      const { data, error } = await supabase
        .from('overtime_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (error) throw error
      
      setDbLogs(data || [])
      generatePaddedLogs(data || [])
    } catch (err) {
      console.error(err)
      setErrorMsg('Failed to fetch history logs. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Generates calendar entries for every single day to ensure "No Missing Days"
  const generatePaddedLogs = (logs) => {
    if (logs.length === 0) {
      setPaddedLogs([])
      return
    }

    // Sort logs ascending to find start date
    const sortedLogs = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date))
    const minDateStr = sortedLogs[0].date
    const todayStr = getLocalDateString()

    const startDate = new Date(minDateStr)
    const endDate = new Date(todayStr)
    
    const allDays = []
    
    // Group logs by date
    const logsByDate = {}
    logs.forEach(log => {
      if (!logsByDate[log.date]) {
        logsByDate[log.date] = []
      }
      logsByDate[log.date].push(log)
    })

    // Loop through every day from start to today
    let current = new Date(startDate)
    while (current <= endDate) {
      const year = current.getFullYear()
      const month = String(current.getMonth() + 1).padStart(2, '0')
      const day = String(current.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`

      if (logsByDate[dateStr]) {
        // Log exists, add it (or multiple if checked in multiple times)
        logsByDate[dateStr].forEach(log => {
          allDays.push({
            ...log,
            isPadded: false
          })
        })
      } else {
        // Log is missing, pad it
        allDays.push({
          id: `padded-${dateStr}`,
          date: dateStr,
          check_in_time: null,
          check_out_time: null,
          duration_minutes: 0,
          description: 'No overtime / Off-day',
          isPadded: true
        })
      }

      current.setDate(current.getDate() + 1)
    }

    // Sort descending for display (latest first)
    allDays.sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.check_in_time) - new Date(a.check_in_time))
    setPaddedLogs(allDays)
  }

  const getLocalDateString = () => {
    const offset = new Date().getTimezoneOffset()
    const local = new Date(new Date().getTime() - offset * 60 * 1000)
    return local.toISOString().split('T')[0]
  }

  const formatMinutes = (minutes) => {
    if (!minutes) return '0m'
    const hrs = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
  }

  const filteredLogs = paddedLogs.filter(log => {
    if (filterType === 'all') return true
    if (filterType === 'overtime') return log.duration_minutes > 0
    if (filterType === 'no-overtime') return log.duration_minutes === 0 || log.isPadded
    return true
  })

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title Header */}
      <div className="glass rounded-3xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-[60px] pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 flex items-center gap-3">
              <CalendarDays className="w-8 h-8 text-emerald-400" />
              Chronicle History
            </h1>
            <p className="text-slate-400 mt-2 text-sm max-w-xl">
              View your absolute history logs. Missing calendar days are automatically filled in to ensure database integrity and full tracking continuity.
            </p>
          </div>
          
          {/* Legend/Info Badge */}
          <div className="flex items-center gap-2 text-xs bg-slate-900/60 border border-slate-800 px-3 py-2 rounded-xl text-slate-400 self-start md:self-auto">
            <Info className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Padded rows represent days without logs.</span>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filter Controllers */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-900">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
              filterType === 'all'
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-md shadow-emerald-500/10'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
            }`}
          >
            All Calendar Days ({paddedLogs.length})
          </button>
          <button
            onClick={() => setFilterType('overtime')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
              filterType === 'overtime'
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-md shadow-emerald-500/10'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
            }`}
          >
            Active Overtime ({dbLogs.filter(d => d.duration_minutes > 0).length})
          </button>
          <button
            onClick={() => setFilterType('no-overtime')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
              filterType === 'no-overtime'
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-md shadow-emerald-500/10'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
            }`}
          >
            Off Days & Zero Logs ({paddedLogs.length - dbLogs.filter(d => d.duration_minutes > 0).length})
          </button>
        </div>
      </div>

      {/* History Data Table */}
      <div className="glass rounded-3xl p-6 md:p-8">
        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-20 text-center text-slate-500 italic text-sm">
            No history logs found for the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="pb-4 font-bold">Date</th>
                  <th className="pb-4 font-bold">Status</th>
                  <th className="pb-4 font-bold">Check-In</th>
                  <th className="pb-4 font-bold">Check-Out</th>
                  <th className="pb-4 font-bold text-right">Duration</th>
                  <th className="pb-4 font-bold pl-6">Work Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredLogs.map((log) => (
                  <tr 
                    key={log.id} 
                    className={`hover:bg-slate-900/30 transition-colors ${
                      log.isPadded ? 'text-slate-500 bg-slate-950/20' : 'text-slate-100'
                    }`}
                  >
                    {/* Date */}
                    <td className="py-4 font-semibold">
                      {new Date(log.date).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </td>
                    
                    {/* Status Badge */}
                    <td className="py-4">
                      {log.isPadded ? (
                        <span className="bg-slate-900 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-850">
                          OFF DAY
                        </span>
                      ) : !log.check_out_time ? (
                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 animate-pulse">
                          ACTIVE
                        </span>
                      ) : (
                        <span className="bg-cyan-500/10 text-cyan-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-cyan-500/20">
                          SAVED
                        </span>
                      )}
                    </td>
                    
                    {/* Check In */}
                    <td className="py-4 font-mono">
                      {log.check_in_time ? (
                        new Date(log.check_in_time).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })
                      ) : (
                        <span className="text-slate-700">--:--</span>
                      )}
                    </td>
                    
                    {/* Check Out */}
                    <td className="py-4 font-mono">
                      {log.check_out_time ? (
                        new Date(log.check_out_time).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })
                      ) : (
                        <span className="text-slate-700">--:--</span>
                      )}
                    </td>
                    
                    {/* Duration */}
                    <td className={`py-4 font-mono font-bold text-right ${log.duration_minutes > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                      {log.duration_minutes ? formatMinutes(log.duration_minutes) : '0m'}
                    </td>
                    
                    {/* Description */}
                    <td className={`py-4 pl-6 max-w-xs truncate text-xs ${log.isPadded ? 'italic text-slate-600' : 'text-slate-400'}`} title={log.description}>
                      {log.description || '-'}
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
