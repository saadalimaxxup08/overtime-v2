import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { FileText, Download, Calendar, Clock, AlertCircle, RefreshCw } from 'lucide-react'

export default function Report({ user }) {
  const [selectedMonth, setSelectedMonth] = useState('') // Format: YYYY-MM
  const [reportLogs, setReportLogs] = useState([])
  const [totalMinutes, setTotalMinutes] = useState(0)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Set default month to current month on mount
  useEffect(() => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    setSelectedMonth(`${yyyy}-${mm}`)
  }, [])

  // Fetch report data when selectedMonth changes
  useEffect(() => {
    if (selectedMonth && user) {
      fetchReportData()
    }
  }, [selectedMonth, user])

  const fetchReportData = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const [yearStr, monthStr] = selectedMonth.split('-')
      const year = parseInt(yearStr, 10)
      const month = parseInt(monthStr, 10)

      // Start and end dates for the month
      const start = `${yearStr}-${monthStr}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const end = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`

      // Fetch logs from database
      const { data, error } = await supabase
        .from('overtime_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true })

      if (error) throw error

      // Group logs by date
      const logsByDate = {}
      data?.forEach((log) => {
        if (!logsByDate[log.date]) {
          logsByDate[log.date] = []
        }
        logsByDate[log.date].push(log)
      })

      // Generate all dates in the month (No Missing Days)
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
          // Pad empty day
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

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF()

      // Header block styling
      doc.setFillColor(15, 23, 42) // Slate 900
      doc.rect(0, 0, 210, 45, 'F')

      // Title
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(22)
      doc.text('OVERTIME TRACKER REPORT', 15, 20)

      // Subtitle / Date details
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(16, 185, 129) // Emerald color indicator
      doc.text('VIP SYSTEM VERIFIED DOCUMENT', 15, 27)

      // Right metadata block
      doc.setTextColor(255, 255, 255)
      const [y, m] = selectedMonth.split('-')
      const monthLabel = new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
      doc.text(`Month: ${monthLabel}`, 140, 20)
      doc.text(`Total Duration: ${formatMinutes(totalMinutes)}`, 140, 27)
      
      // Bottom line in header
      doc.setFillColor(16, 185, 129) // Emerald 500
      doc.rect(0, 43, 210, 2, 'F')

      // Metadata info table
      doc.setTextColor(51, 65, 85) // Slate 700
      doc.setFontSize(9)
      doc.text(`Report For: ${user.email}`, 15, 53)
      doc.text(`Generated On: ${new Date().toLocaleString()}`, 15, 58)

      // Table formatting
      const tableRows = reportLogs.map((log) => {
        const dateFormatted = new Date(log.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        const checkIn = log.check_in_time
          ? new Date(log.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : '--'
        const checkOut = log.check_out_time
          ? new Date(log.check_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : '--'
        const duration = log.duration_minutes ? formatMinutes(log.duration_minutes) : '0h 0m'
        const desc = log.description || (log.isPadded ? 'Off day' : '-')

        return [dateFormatted, log.isPadded ? 'OFF DAY' : 'OVERTIME', checkIn, checkOut, duration, desc]
      })

      // Generate AutoTable
      doc.autoTable({
        startY: 65,
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
          4: { halign: 'right', fontStyle: 'bold' }, // Duration column
          5: { cellWidth: 50 }, // Description column limit
        },
        margin: { left: 15, right: 15 },
        theme: 'striped',
      })

      // Save PDF
      doc.save(`Overtime_Report_${selectedMonth}.pdf`)
    } catch (err) {
      console.error(err)
      setErrorMsg('Could not export PDF. Please check data format.')
    }
  }

  const [y, m] = selectedMonth ? selectedMonth.split('-') : ['', '']
  const monthName = selectedMonth ? new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' }) : ''

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Info */}
      <div className="glass rounded-3xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-[60px] pointer-events-none"></div>
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

          {/* Month Picker Control */}
          <div className="flex flex-col gap-1.5 self-start md:self-auto min-w-[200px]">
            <label className="text-slate-400 text-xs font-bold uppercase tracking-wider">Select Month</label>
            <div className="relative">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 pl-10 text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition duration-200"
              />
              <Calendar className="w-4.5 h-4.5 text-slate-650 absolute left-3.5 top-3.5" />
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Total Overtime */}
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

        {/* Download Button Card */}
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

      {/* Preview Section */}
      <div className="glass rounded-3xl p-6 md:p-8">
        <div className="flex justify-between items-center mb-6 border-b border-slate-900 pb-4">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            Preview: {monthName} Calendar Records
          </h2>
          {loading && <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />}
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : reportLogs.length === 0 ? (
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {reportLogs.map((log) => (
                  <tr 
                    key={log.id} 
                    className={`hover:bg-slate-900/30 transition-colors ${
                      log.isPadded ? 'text-slate-650 bg-slate-950/10' : 'text-slate-100'
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
                      {log.isPadded ? (
                        <span className="bg-slate-900 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-850">
                          OFF
                        </span>
                      ) : (
                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                          OVERTIME
                        </span>
                      )}
                    </td>
                    <td className="font-mono">
                      {log.check_in_time ? (
                        new Date(log.check_in_time).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })
                      ) : (
                        <span className="text-slate-800">--:--</span>
                      )}
                    </td>
                    <td className="font-mono">
                      {log.check_out_time ? (
                        new Date(log.check_out_time).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })
                      ) : (
                        <span className="text-slate-800">--:--</span>
                      )}
                    </td>
                    <td className={`font-mono font-bold text-right ${log.duration_minutes > 0 ? 'text-emerald-400' : 'text-slate-700'}`}>
                      {log.duration_minutes ? formatMinutes(log.duration_minutes) : '0h 0m'}
                    </td>
                    <td className={`pl-6 max-w-[180px] truncate text-xs ${log.isPadded ? 'italic text-slate-700' : 'text-slate-400'}`}>
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
