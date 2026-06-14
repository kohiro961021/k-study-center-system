import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, RefreshCw, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useApi } from '../../hooks';

const QR_LIFETIME_SECONDS = 180; // 3 分鐘

export function QRCodeView() {
    const apiCall = useApi();
    const [qrToken, setQrToken] = useState<string>('');
    const [expiresAt, setExpiresAt] = useState<Date | null>(null);
    const [secondsLeft, setSecondsLeft] = useState<number>(QR_LIFETIME_SECONDS);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [studentName, setStudentName] = useState<string>('');
    const [studentId, setStudentId] = useState<string>('');

    const fetchQRToken = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiCall('/api/attendance/qr');
            setQrToken(res.token);
            setStudentName(res.name);
            setStudentId(res.student_id);
            const exp = new Date(res.expires_at);
            setExpiresAt(exp);
            const diff = Math.round((exp.getTime() - Date.now()) / 1000);
            setSecondsLeft(Math.max(0, diff));
        } catch (err: any) {
            setError(err.message || '無法取得 QR Code，請稍後再試');
        } finally {
            setLoading(false);
        }
    }, [apiCall]);

    // 初始載入
    useEffect(() => {
        fetchQRToken();
    }, [fetchQRToken]);

    // 每秒更新倒數計時
    useEffect(() => {
        if (!expiresAt) return;
        const interval = setInterval(() => {
            const diff = Math.round((expiresAt.getTime() - Date.now()) / 1000);
            const left = Math.max(0, diff);
            setSecondsLeft(left);
            if (left === 0) {
                // 到期後自動刷新
                fetchQRToken();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [expiresAt, fetchQRToken]);

    const progressPct = (secondsLeft / QR_LIFETIME_SECONDS) * 100;
    const isExpiringSoon = secondsLeft <= 30;

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-6 max-w-md mx-auto">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <QrCode className="w-6 h-6 text-accent" />
                QR Code 點名
            </h2>

            {error ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3">
                    <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
                    <p className="text-red-700 font-medium">{error}</p>
                    <button
                        onClick={fetchQRToken}
                        className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 transition"
                    >
                        重試
                    </button>
                </div>
            ) : (
                <div className="bg-card/70 glass-card rounded-2xl border border-slate-200 p-6 space-y-5">
                    {/* 學生資訊 */}
                    {studentName && (
                        <div className="text-center text-sm text-slate-500">
                            <span className="font-bold text-slate-700">{studentName}</span>
                            <span className="ml-2 text-slate-400">（{studentId}）</span>
                        </div>
                    )}

                    {/* QR Code */}
                    <div className="flex justify-center">
                        {loading ? (
                            <div className="w-52 h-52 flex items-center justify-center bg-slate-100 rounded-2xl">
                                <RefreshCw className="w-10 h-10 text-slate-400 animate-spin" />
                            </div>
                        ) : qrToken ? (
                            <div className={`p-4 rounded-2xl transition-all ${isExpiringSoon ? 'bg-red-50 ring-2 ring-red-300' : 'bg-white'}`}>
                                <QRCodeSVG
                                    value={qrToken}
                                    size={208}
                                    level="M"
                                    bgColor={isExpiringSoon ? '#fff1f2' : '#ffffff'}
                                    fgColor={isExpiringSoon ? '#dc2626' : '#1e293b'}
                                />
                            </div>
                        ) : null}
                    </div>

                    {/* 倒數計時 */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className={`flex items-center gap-1.5 font-medium ${isExpiringSoon ? 'text-red-600' : 'text-slate-600'}`}>
                                <Clock className="w-4 h-4" />
                                {isExpiringSoon ? '即將過期！' : '有效時間'}
                            </span>
                            <span className={`font-mono font-bold text-lg ${isExpiringSoon ? 'text-red-600' : 'text-accent'}`}>
                                {formatTime(secondsLeft)}
                            </span>
                        </div>
                        {/* Progress bar */}
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ${isExpiringSoon ? 'bg-red-400' : 'bg-accent'}`}
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                        <p className="text-xs text-slate-400 text-center">QR Code 每 3 分鐘自動更新</p>
                    </div>

                    {/* 手動刷新按鈕 */}
                    <button
                        onClick={fetchQRToken}
                        disabled={loading}
                        className="w-full py-3 flex items-center justify-center gap-2 bg-accent/10 hover:bg-accent/20 text-accent font-bold rounded-xl transition border border-accent/20 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        立即刷新 QR Code
                    </button>
                </div>
            )}

            {/* 說明 */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
                <div className="flex items-start gap-2 text-sm text-blue-700">
                    <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
                    <span>將此 QR Code 對準 K館門口的平板鏡頭，即可完成今日簽到。</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-blue-700">
                    <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
                    <span>每個 QR Code 僅有效 3 分鐘，過期會自動產生新的。</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-blue-700">
                    <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
                    <span>晚上 10 點前未簽到將自動記為缺席。</span>
                </div>
            </div>
        </div>
    );
}
