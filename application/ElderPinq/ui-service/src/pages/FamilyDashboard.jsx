import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HeartPulse, Bell, CheckCircle2, XCircle, Pill, TrendingUp,
  User, LogOut, RefreshCw, AlertTriangle, Clock, Link as LinkIcon, Plus
} from 'lucide-react';
import { getCachedUser, logout, getLinkedElders, linkElder, getUserById } from '../api/authApi';
import { getVitals } from '../api/healthApi';
import { createReminder as addReminder, getReminders } from '../api/reminderApi';
import { getAlerts } from '../api/alertApi';

function StatusBadge({ status }) {
  const ok = status === 'feeling_well' || status === 'vitals_logged';
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${
      ok ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
    }`}>
      {ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {ok ? 'Well' : 'Needs Attention'}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, bgGradient, iconColor }) {
  return (
    <div className={`rounded-2xl shadow-lg p-6 bg-gradient-to-br ${bgGradient} border border-white/40`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg bg-white/60 ${iconColor}`}>
          <Icon className="w-6 h-6" />
        </div>
        <p className="text-gray-700 font-bold text-sm uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-4xl font-extrabold text-gray-900 mt-2">{value ?? '—'}</p>
    </div>
  );
}

export default function FamilyDashboard() {
  const navigate = useNavigate();
  const user = getCachedUser();

  const [elders, setElders] = useState([]);
  const [selectedElderId, setSelectedElderId] = useState(null);
  const [elderName, setElderName] = useState('');

  const [healthLogs, setHealthLogs]   = useState([]);
  const [reminders, setReminders]     = useState([]);
  const [alerts, setAlerts]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [fetchError, setFetchError]   = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Link form
  const [linkCode, setLinkCode] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);

  // Add Med form
  const [medForm, setMedForm] = useState({ name: '', dosage: '', time: '08:00' });
  const [medLoading, setMedLoading] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!user || user.role !== 'family') navigate('/login', { replace: true });
  }, []);

  const fetchElders = useCallback(async () => {
    try {
      const data = await getLinkedElders();
      setElders(data);
      if (data.length > 0 && !selectedElderId) {
        setSelectedElderId(data[0].id);
        setElderName(data[0].username);
      }
    } catch (err) {
      setFetchError("Could not load linked elders.");
    }
  }, [selectedElderId]);

  useEffect(() => { fetchElders(); }, [fetchElders]);

  const fetchData = useCallback(async () => {
    if (!selectedElderId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError('');
    try {
      const [hResult, rResult, aResult, uResult] = await Promise.allSettled([
        getVitals(selectedElderId),
        getReminders(selectedElderId),
        getAlerts(),
        getUserById(selectedElderId)
      ]);

      if (hResult.status === 'fulfilled') setHealthLogs(hResult.value);
      if (rResult.status === 'fulfilled') setReminders(rResult.value);
      if (aResult.status === 'fulfilled') setAlerts(aResult.value);
      if (uResult.status === 'fulfilled' && uResult.value?.username) {
        setElderName(uResult.value.username);
      }

      const failed = [hResult, rResult, aResult]
        .filter((r) => r.status === 'rejected')
        .map((r) => r.reason?.message);
      if (failed.length) setFetchError(`Some data could not be loaded: ${failed.join('; ')}`);
    } catch (err) {
      setFetchError(err.message);
    } finally {
      setLastRefresh(new Date());
      setLoading(false);
    }
  }, [selectedElderId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLinkElder = async (e) => {
    e.preventDefault();
    if (!linkCode) return;
    setLinkLoading(true);
    try {
      const res = await linkElder(linkCode);
      setLinkCode('');
      await fetchElders();
      setSelectedElderId(res.data?.elderId || res.elderId); // Handle axios response structure correctly
    } catch (err) {
      alert("Failed to link elder: " + (err.response?.data?.error || err.message));
    } finally {
      setLinkLoading(false);
    }
  };

  const handleAddMed = async (e) => {
    e.preventDefault();
    if (!selectedElderId || !medForm.name || !medForm.dosage || !medForm.time) return;
    setMedLoading(true);
    try {
      await addReminder({
        userId: selectedElderId,
        medicationName: medForm.name,
        dosage: medForm.dosage,
        timeOfDay: medForm.time + ':00' // backend expects time string
      });
      setMedForm({ name: '', dosage: '', time: '08:00' });
      fetchData(); // refresh meds
    } catch (err) {
      alert("Failed to add medication: " + (err.response?.data?.error || err.message));
    } finally {
      setMedLoading(false);
    }
  };

  const handleElderChange = (e) => {
    const id = parseInt(e.target.value);
    setSelectedElderId(id);
    const elder = elders.find(el => el.id === id);
    if(elder) setElderName(elder.username);
  };

  const latestLog  = healthLogs[0];
  const medsTaken  = reminders.filter((r) => r.taken).length;
  const medsTotal  = reminders.length;
  const latestHR   = healthLogs.find((l) => l.heart_rate)?.heart_rate;
  const latestBP   = healthLogs.find((l) => l.blood_pressure)?.blood_pressure;
  const checkIns   = healthLogs.filter((l) => l.status === 'feeling_well').length;

  let overallStatus = 'Doing Well 😊';
  let isWarning = false;

  if (latestHR || latestBP) {
    let sys = 120, dia = 80;
    if (latestBP && latestBP.includes('/')) {
      [sys, dia] = latestBP.split('/').map(Number);
    }
    
    if (
      (latestHR && (latestHR < 60 || latestHR > 100)) || 
      (latestBP && (sys < 90 || sys > 140 || dia < 60 || dia > 90))
    ) {
      overallStatus = 'Needs Attention ⚠️';
      isWarning = true;
    }
  } else if (latestLog && latestLog.status !== 'feeling_well' && latestLog.status !== 'vitals_logged') {
    overallStatus = 'Needs Attention ⚠️';
    isWarning = true;
  }

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-pink-50 font-sans pb-10">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 text-white px-6 py-5 flex items-center justify-between shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 to-indigo-500"></div>
        <div className="flex items-center gap-3 relative z-10">
          <HeartPulse className="w-10 h-10 text-pink-400" />
          <span className="text-3xl font-extrabold tracking-tight drop-shadow-md">ElderPing</span>
          <span className="ml-3 bg-white/20 backdrop-blur-md text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-widest border border-white/30 hidden sm:inline">
            Family View
          </span>
        </div>
        <div className="flex items-center gap-4 relative z-10">
          <button
            onClick={fetchData}
            disabled={loading || !selectedElderId}
            className="flex items-center gap-2 bg-indigo-600/50 hover:bg-indigo-600 backdrop-blur-md px-4 py-2.5 rounded-xl font-semibold transition-all shadow-md border border-white/10"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md px-5 py-2.5 rounded-xl font-semibold transition-all shadow-md border border-white/20"
          >
            <LogOut className="w-5 h-5" /> <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Top Controls: Link Elder & Select Elder */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          
          <div className="bg-white/80 backdrop-blur-lg rounded-[2rem] p-6 shadow-lg border border-white/60">
            <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" /> Monitoring Elder
            </h3>
            {elders.length === 0 ? (
              <p className="text-gray-500 italic">No elders linked yet.</p>
            ) : (
              <select 
                value={selectedElderId || ''} 
                onChange={handleElderChange}
                className="w-full bg-gray-50 border-2 border-indigo-100 rounded-xl px-4 py-3 text-lg font-bold text-gray-800 focus:outline-none focus:border-indigo-500 transition-colors"
              >
                {elders.map(e => <option key={e.id} value={e.id}>{e.username}</option>)}
              </select>
            )}
          </div>

          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-[2rem] p-6 shadow-lg text-white">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <LinkIcon className="w-5 h-5" /> Link New Elder
            </h3>
            <form onSubmit={handleLinkElder} className="flex gap-3">
              <input 
                type="text" 
                placeholder="Elder's Invite Code" 
                value={linkCode}
                onChange={e => setLinkCode(e.target.value.toUpperCase())}
                className="flex-1 rounded-xl px-4 py-3 text-gray-900 font-medium focus:outline-none focus:ring-4 focus:ring-indigo-300"
              />
              <button 
                type="submit" 
                disabled={linkLoading}
                className="bg-white text-indigo-700 hover:bg-indigo-50 font-bold px-6 py-3 rounded-xl transition-colors shadow-md disabled:opacity-50"
              >
                {linkLoading ? 'Linking…' : 'Link'}
              </button>
            </form>
          </div>
        </div>

        {!selectedElderId ? (
          <div className="text-center py-20 bg-white/50 backdrop-blur-md rounded-[2rem] border border-white/60 shadow-lg">
            <User className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-600">No Elder Selected</h2>
            <p className="text-gray-500 mt-2">Please link an elder using their invite code above.</p>
          </div>
        ) : (
          <>
            {/* Title row */}
            <div className="flex items-center justify-between mb-6 px-2">
              <div>
                <p className="text-indigo-600 font-bold uppercase tracking-widest text-sm">Status Dashboard</p>
                <h1 className="text-5xl font-extrabold text-gray-900 capitalize drop-shadow-sm mt-1">
                  {elderName}'s Health
                </h1>
              </div>
              <div className="text-right text-sm font-medium text-gray-500 bg-white/60 px-4 py-2 rounded-full shadow-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" />
                Updated: {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            {/* Partial error banner */}
            {fetchError && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-800 rounded-xl p-5 shadow-sm font-medium">
                ⚠️ {fetchError}
              </div>
            )}

            {/* Status hero card */}
            <div className={`rounded-[2rem] shadow-xl p-10 mb-8 flex flex-col md:flex-row md:items-center justify-between text-white relative overflow-hidden border border-white/20 ${
              loading
                ? 'bg-gradient-to-r from-gray-400 to-gray-500'
                : !latestLog
                  ? 'bg-gradient-to-r from-gray-500 to-gray-600'
                  : isWarning
                    ? 'bg-gradient-to-r from-red-500 to-rose-600'
                    : 'bg-gradient-to-r from-green-500 to-emerald-600'
            }`}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
              <div className="flex items-center gap-6 relative z-10">
                <div className="bg-white/20 backdrop-blur-md rounded-2xl p-6 shadow-inner">
                  <User className="w-16 h-16" />
                </div>
                <div>
                  <p className="text-xl opacity-90 font-medium tracking-wide">Overall Status</p>
                  <p className="text-6xl font-extrabold mt-1 drop-shadow-md">
                    {loading ? 'Loading…' : latestLog ? overallStatus : 'No Data Yet'}
                  </p>
                  {latestLog && (
                    <p className="opacity-80 font-medium mt-3 bg-black/10 inline-block px-4 py-1.5 rounded-full">
                      Last check-in: {new Date(latestLog.created_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              {latestLog && !loading && (
                isWarning 
                  ? <AlertTriangle className="w-32 h-32 opacity-20 absolute right-10 bottom-auto pointer-events-none" />
                  : <CheckCircle2 className="w-32 h-32 opacity-20 absolute right-10 bottom-auto pointer-events-none" />
              )}
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              <StatCard icon={HeartPulse} label="Heart Rate" value={latestHR ? `${latestHR} bpm` : null} bgGradient="from-red-50 to-pink-50" iconColor="text-red-500" />
              <StatCard icon={TrendingUp} label="Blood Pressure" value={latestBP} bgGradient="from-blue-50 to-indigo-50" iconColor="text-blue-500" />
              <StatCard icon={CheckCircle2} label="Check-ins Today" value={checkIns} bgGradient="from-green-50 to-emerald-50" iconColor="text-green-500" />
              <StatCard icon={Pill} label="Meds Taken" value={medsTotal > 0 ? `${medsTaken}/${medsTotal}` : '—'} bgGradient="from-purple-50 to-fuchsia-50" iconColor="text-purple-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
              {/* Medication Section (Takes 2 columns) */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                
                {/* Add Medication Form */}
                <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-lg p-6 border border-white/60">
                  <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Plus className="w-6 h-6 text-indigo-600" /> Add Medication
                  </h2>
                  <form onSubmit={handleAddMed} className="flex flex-col md:flex-row gap-4">
                    <input type="text" placeholder="Medication Name" value={medForm.name} onChange={e=>setMedForm({...medForm, name: e.target.value})} className="flex-1 bg-gray-50 border-2 border-indigo-100 rounded-xl px-4 py-3 font-medium text-gray-800 focus:border-indigo-400 focus:outline-none" required />
                    <input type="text" placeholder="Dosage (e.g. 1 pill)" value={medForm.dosage} onChange={e=>setMedForm({...medForm, dosage: e.target.value})} className="w-full md:w-40 bg-gray-50 border-2 border-indigo-100 rounded-xl px-4 py-3 font-medium text-gray-800 focus:border-indigo-400 focus:outline-none" required />
                    <input type="time" value={medForm.time} onChange={e=>setMedForm({...medForm, time: e.target.value})} className="w-full md:w-32 bg-gray-50 border-2 border-indigo-100 rounded-xl px-4 py-3 font-bold text-gray-800 focus:border-indigo-400 focus:outline-none" required />
                    <button type="submit" disabled={medLoading} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold px-8 py-3 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50">
                      {medLoading ? 'Adding...' : 'Add'}
                    </button>
                  </form>
                </div>

                {/* Medication Tracker */}
                <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-lg overflow-hidden border border-white/60">
                  <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-5 flex items-center gap-3">
                    <Pill className="w-8 h-8 text-white/90" />
                    <h2 className="text-2xl font-extrabold text-white">Medication Tracker</h2>
                  </div>
                  {reminders.length === 0 ? (
                    <p className="text-gray-400 text-center py-12 font-medium">
                      {loading ? 'Loading…' : 'No medications scheduled.'}
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {reminders.map((r) => (
                        <li key={r.id} className="flex items-center justify-between px-8 py-5 hover:bg-purple-50/30 transition-colors">
                          <div className="flex flex-col">
                            <p className="text-xl font-extrabold text-gray-800 tracking-tight">{r.medication_name}</p>
                            <p className="text-purple-600 font-semibold">{r.dosage} &bull; {r.time_of_day?.slice(0, 5)}</p>
                          </div>
                          {r.taken
                            ? <span className="flex items-center gap-2 text-green-600 bg-green-100 px-4 py-2 rounded-full font-bold shadow-sm border border-green-200"><CheckCircle2 className="w-5 h-5" /> Taken</span>
                            : <span className="flex items-center gap-2 text-yellow-600 bg-yellow-100 px-4 py-2 rounded-full font-bold shadow-sm border border-yellow-200"><XCircle className="w-5 h-5" /> Pending</span>
                          }
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Right Column: Health Logs & Alerts */}
              <div className="flex flex-col gap-6">
                
                {/* Alerts */}
                {alerts.length > 0 && (
                  <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-lg overflow-hidden border border-white/60">
                    <div className="bg-gradient-to-r from-red-600 to-rose-500 px-6 py-4 flex items-center gap-2">
                      <Bell className="w-6 h-6 text-white/90" />
                      <h2 className="text-xl font-bold text-white">System Alerts</h2>
                    </div>
                    <ul className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                      {alerts.slice(0, 5).map((a) => (
                        <li key={a.id} className="px-6 py-4 flex items-start gap-3">
                          <AlertTriangle className={`w-6 h-6 mt-0.5 flex-shrink-0 ${
                            a.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'
                          }`} />
                          <div>
                            <p className="font-bold text-gray-800 leading-tight">[{a.service_name}] {a.message}</p>
                            <p className="text-xs text-gray-400 mt-1 font-medium">{new Date(a.created_at).toLocaleString()}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Health log feed */}
                <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-lg overflow-hidden border border-white/60 flex-1">
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-500 px-6 py-4 flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-white/90" />
                    <h2 className="text-xl font-bold text-white">Recent Health Logs</h2>
                  </div>
                  {healthLogs.length === 0 ? (
                    <p className="text-gray-400 text-center py-12 font-medium">
                      {loading ? 'Loading…' : 'No health logs yet.'}
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                      {healthLogs.map((log) => (
                        <li key={log.id} className="flex flex-col px-6 py-4 hover:bg-blue-50/30 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <StatusBadge status={log.status} />
                            <p className="text-xs text-gray-400 font-medium">
                              {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          {log.heart_rate && (
                            <p className="text-sm font-semibold text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                              HR: <span className="text-red-500">{log.heart_rate} bpm</span> &bull; BP: <span className="text-blue-500">{log.blood_pressure}</span>
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
