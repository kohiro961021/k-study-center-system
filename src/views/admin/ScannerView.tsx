import { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { ScanLine, CheckCircle2, XCircle, Camera, CameraOff, RefreshCw, Maximize, Minimize } from 'lucide-react';
import { useApi } from '../../hooks';

type ScanResult = {
    type: 'success' | 'error' | 'already';
    message: string;
    student_name?: string;
    student_id?: string;
    seat_label?: string;
};

const RESULT_DISPLAY_MS = 3500; // 掃描結果顯示時間（毫秒）

export function ScannerView() {
    const apiCall = useApi();
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const controlsRef = useRef<IScannerControls | null>(null);
    const processingRef = useRef(false); // 防止重複觸發

    const [scanning, setScanning] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [scanCount, setScanCount] = useState(0);
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [activeDeviceId, setActiveDeviceId] = useState<string>('');
    const [mirrored, setMirrored] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const handleScanResult = useCallback(async (token: string) => {
        if (processingRef.current) return;
        processingRef.current = true;

        try {
            const res = await apiCall('/api/attendance/scan', 'POST', { token });
            setScanResult({
                type: res.already_checked_in ? 'already' : 'success',
                message: res.message,
                student_name: res.student_name,
                student_id: res.student_id,
                seat_label: res.seat_label,
            });
            if (!res.already_checked_in) {
                setScanCount(c => c + 1);
            }
        } catch (err: any) {
            setScanResult({
                type: 'error',
                message: err.message || 'QR Code 無效或已過期',
            });
        }

        // 幾秒後清除結果，繼續掃描
        setTimeout(() => {
            setScanResult(null);
            processingRef.current = false;
        }, RESULT_DISPLAY_MS);
    }, [apiCall]);

    const startScanner = useCallback(async (targetDeviceId?: string) => {
        if (!videoRef.current) return;
        setCameraError(null);
        setScanning(true);

        const codeReader = new BrowserQRCodeReader();
        try {
            const devices = await BrowserQRCodeReader.listVideoInputDevices();
            setVideoDevices(devices);

            let deviceId = targetDeviceId;
            if (!deviceId && devices.length > 0) {
                // 優先選前置鏡頭（label 含 "front" 或 "user" 或 "前" 或 "facing front"）
                const front = devices.find(d =>
                    d.label.toLowerCase().includes('front') ||
                    d.label.toLowerCase().includes('user') ||
                    d.label.toLowerCase().includes('前') ||
                    d.label.toLowerCase().includes('facing front')
                );
                deviceId = front?.deviceId || devices[0].deviceId;
            }

            if (deviceId) {
                setActiveDeviceId(deviceId);
                // 自動判定是否需要鏡像：如果名稱包含 front, user, 前, facing front，或者標籤是空的，則預設鏡像
                const dev = devices.find(d => d.deviceId === deviceId);
                const label = dev?.label.toLowerCase() || '';
                const isFront = label.includes('front') || label.includes('user') || label.includes('前') || label.includes('facing front') || label === '';
                setMirrored(isFront);
            }

            const controls = await codeReader.decodeFromVideoDevice(
                deviceId,
                videoRef.current,
                (result, error) => {
                    if (result && !processingRef.current) {
                        handleScanResult(result.getText());
                    }
                }
            );
            controlsRef.current = controls;

            // 📷 嘗試啟用「連續自動對焦」模式
            try {
                const stream = videoRef.current?.srcObject as MediaStream;
                if (stream) {
                    const track = stream.getVideoTracks()[0];
                    if (track) {
                        const capabilities = track.getCapabilities() as any;
                        if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
                            await track.applyConstraints({
                                advanced: [{ focusMode: 'continuous' }]
                            } as any);
                            console.log('📷 鏡頭已成功切換至「連續自動對焦」模式');
                        }
                    }
                }
            } catch (focusErr) {
                console.warn('📷 啟用鏡頭對焦模式失敗（硬體或瀏覽器限制，不影響基本掃描）：', focusErr);
            }
        } catch (err: any) {
            setScanning(false);
            if (err.name === 'NotAllowedError') {
                setCameraError('請允許存取鏡頭權限後重試');
            } else if (err.name === 'NotFoundError') {
                setCameraError('找不到鏡頭裝置');
            } else {
                setCameraError(`無法啟動鏡頭：${err.message}`);
            }
        }
    }, [handleScanResult]);

    const stopScanner = useCallback(() => {
        if (controlsRef.current) {
            controlsRef.current.stop();
            controlsRef.current = null;
        }
        setScanning(false);
    }, []);

    const handleDeviceChange = useCallback(async (newDeviceId: string) => {
        if (controlsRef.current) {
            controlsRef.current.stop();
            controlsRef.current = null;
        }
        await startScanner(newDeviceId);
    }, [startScanner]);

    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch((err) => {
                alert(`無法啟動全螢幕模式：${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(document.fullscreenElement === containerRef.current);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    useEffect(() => {
        // 進入頁面自動啟動
        startScanner();
        return () => stopScanner();
    }, [startScanner, stopScanner]);

    return (
        <div
            ref={containerRef}
            className={`space-y-5 max-w-xl mx-auto transition-all ${
                isFullscreen 
                    ? 'w-full h-full bg-slate-100 p-6 md:p-12 overflow-y-auto max-w-none flex flex-col items-center justify-center' 
                    : ''
            }`}
        >
            <div className={isFullscreen ? 'w-full max-w-xl space-y-5 my-auto' : 'space-y-5'}>
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <ScanLine className="w-6 h-6 text-amber-600" />
                        QR Code 掃描器
                    </h2>
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm text-slate-500">
                            今日已簽到：<span className="font-bold text-emerald-600">{scanCount}</span> 人
                        </span>
                        
                        {/* 鏡像切換按鈕 */}
                        <button
                            onClick={() => setMirrored(m => !m)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                                mirrored
                                    ? 'text-amber-700 bg-amber-50 border-amber-200'
                                    : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50'
                            }`}
                            title="鏡像翻轉相機畫面"
                        >
                            鏡像：{mirrored ? '開' : '關'}
                        </button>

                        {videoDevices.length > 1 && (
                            <select
                                value={activeDeviceId}
                                onChange={(e) => handleDeviceChange(e.target.value)}
                                className="text-sm border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white font-semibold focus:outline-none cursor-pointer"
                            >
                                {videoDevices.map((d, index) => (
                                    <option key={d.deviceId} value={d.deviceId}>
                                        {d.label || `鏡頭 ${index + 1}`}
                                    </option>
                                ))}
                            </select>
                        )}

                        {/* 全螢幕切換按鈕 */}
                        <button
                            onClick={toggleFullscreen}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            title={isFullscreen ? '退出全螢幕' : '進入全螢幕'}
                        >
                            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                            {isFullscreen ? '退出全螢幕' : '全螢幕模式'}
                        </button>

                        <button
                            onClick={scanning ? stopScanner : () => startScanner(activeDeviceId)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition border ${
                                scanning
                                    ? 'text-red-600 border-red-200 hover:bg-red-50'
                                    : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                            }`}
                        >
                            {scanning ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                            {scanning ? '停止' : '啟動'}
                        </button>
                    </div>
                </div>

                {/* Camera View */}
                <div className="relative bg-slate-900 rounded-2xl overflow-hidden aspect-[4/3] border-2 border-slate-700 shadow-xl">
                    <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        style={{ transform: mirrored ? 'scaleX(-1)' : 'none' }}
                        playsInline
                        muted
                    />

                    {/* Scanning overlay */}
                    {scanning && !cameraError && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            {/* Corner brackets */}
                            <div className="relative w-52 h-52">
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-amber-400 rounded-tl-sm" />
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-amber-400 rounded-tr-sm" />
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-amber-400 rounded-bl-sm" />
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-amber-400 rounded-br-sm" />
                                {/* Scan line animation */}
                                <div
                                    className="absolute left-2 right-2 h-0.5 bg-amber-400/80 shadow-[0_0_8px_2px_rgba(251,191,36,0.5)]"
                                    style={{ animation: 'scan-line 2s ease-in-out infinite' }}
                                />
                            </div>
                            <div className="absolute bottom-4 left-0 right-0 text-center text-amber-300 text-sm font-medium">
                                請將學生的 QR Code 對準框框
                            </div>
                        </div>
                    )}

                    {/* Camera error overlay */}
                    {cameraError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 bg-slate-900/95">
                            <XCircle className="w-12 h-12 text-red-400" />
                            <p className="text-white text-center text-sm">{cameraError}</p>
                            <button
                                onClick={() => startScanner(activeDeviceId)}
                                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 transition"
                            >
                                <RefreshCw className="w-4 h-4" />
                                重試
                            </button>
                        </div>
                    )}

                    {/* Not started overlay */}
                    {!scanning && !cameraError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900/95">
                            <Camera className="w-12 h-12 text-slate-500" />
                            <p className="text-slate-400 text-sm">鏡頭已停止</p>
                            <button
                                onClick={() => startScanner(activeDeviceId)}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition"
                            >
                                <Camera className="w-4 h-4" />
                                啟動鏡頭
                            </button>
                        </div>
                    )}
                </div>

                {/* Scan Result Toast */}
                {scanResult && (
                    <div className={`rounded-2xl border p-5 transition-all ${
                        scanResult.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200'
                            : scanResult.type === 'already'
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-red-50 border-red-200'
                    }`}>
                        <div className="flex items-start gap-3">
                            {scanResult.type === 'success' && <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0 mt-0.5" />}
                            {scanResult.type === 'already' && <CheckCircle2 className="w-8 h-8 text-amber-500 shrink-0 mt-0.5" />}
                            {scanResult.type === 'error' && <XCircle className="w-8 h-8 text-red-500 shrink-0 mt-0.5" />}
                            <div className="space-y-1">
                                <p className={`font-bold text-lg ${
                                    scanResult.type === 'success' ? 'text-emerald-700'
                                    : scanResult.type === 'already' ? 'text-amber-700'
                                    : 'text-red-700'
                                }`}>
                                    {scanResult.message}
                                </p>
                                {scanResult.student_id && (
                                    <p className="text-sm text-slate-500">
                                        學號：{scanResult.student_id}
                                        {scanResult.seat_label && <span className="ml-3">座位：{scanResult.seat_label}</span>}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Instructions */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-500 space-y-1">
                    <p>• 此頁面為平板掃描專用，請將平板放置於 K館路口。</p>
                    <p>• 掃描成功後會顯示綠色提示，{RESULT_DISPLAY_MS / 1000} 秒後自動繼續掃描。</p>
                    <p>• 每個 QR Code 有效期限為 3 分鐘，過期後請學生重新產生。</p>
                </div>

                {/* Developer Debug Panel (Localhost / Development Only) */}
                {(import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
                    <div className="bg-amber-50/50 border border-dashed border-amber-200 rounded-xl p-4 space-y-2">
                        <p className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
                            🔧 開發者偵錯工具 (僅在本地開發環境顯示)
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="貼上學生的 QR Token 進行模擬掃描"
                                id="debug-token-input"
                                className="flex-1 min-w-0 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const input = e.currentTarget;
                                        if (input.value.trim()) {
                                            handleScanResult(input.value.trim());
                                            input.value = '';
                                        }
                                    }
                                }}
                            />
                            <button
                                onClick={() => {
                                    const input = document.getElementById('debug-token-input') as HTMLInputElement;
                                    if (input && input.value.trim()) {
                                        handleScanResult(input.value.trim());
                                        input.value = '';
                                    }
                                }}
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-bold shadow-sm transition"
                            >
                                送出模擬
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes scan-line {
                    0% { top: 8px; }
                    50% { top: calc(100% - 8px); }
                    100% { top: 8px; }
                }
            `}</style>
        </div>
    );
}

