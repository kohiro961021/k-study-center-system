import { useState, useEffect } from 'react';

export const useCurrentTime = () => {
	const [currentTime, setCurrentTime] = useState(new Date());
	
	useEffect(() => {
		const timer = setInterval(() => setCurrentTime(new Date()), 1000);
		return () => clearInterval(timer);
	}, []);
	
	return {
		timeString: currentTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
		dateString: currentTime.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
	};
};
