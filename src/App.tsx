import { useState, useEffect, useRef } from 'react';
import './App.css';
import { UserAgent, Inviter, SessionState, Session } from 'sip.js';

function App() {
  // 定義狀態變數
  const [wsServer] = useState('wss://bonuc.sbc.telesale.org:7443/ws'); // WebSocket 伺服器地址
  const [domains] = useState('bonuc.sbc.telesale.org'); // SIP 域名
  const [username] = useState('3005'); // 使用者名稱
  const [password] = useState('1234'); // 密碼
  const [displayName] = useState('Leo'); // 顯示名稱
  const [callNumber, setCallNumber] = useState(''); // 要撥打的號碼
  const [userAgent, setUserAgent] = useState<UserAgent | null>(null); // SIP.js 的 UserAgent
  const [currentSession, setCurrentSession] = useState<Session | null>(null); // 當前的通話會話
  const ringbackAudioRef = useRef<HTMLAudioElement | null>(null); // 音檔的引用

  const [callState, setCallState] = useState<string>(''); // 通話狀態

  useEffect(() => {
    // 組件卸載時清理
    return () => {
      if (userAgent) {
        userAgent.stop(); // 停止 UserAgent
      }
    };
  }, [userAgent]);

  const handleCall = async (event: { preventDefault: () => void }, callToNumber: string | null = null) => {
    event.preventDefault(); // 阻止表單提交的默認行為

    if (currentSession) {
      // 如果有當前的通話，則根據狀態掛斷或取消
      if (currentSession.state === SessionState.Establishing) {
        currentSession.cancel(); // 取消正在建立的呼叫
        setCallState("呼叫已取消");
      } else {
        currentSession.bye(); // 掛斷已建立的通話
        setCallState("通話已掛斷");
      }
      setCurrentSession(null); // 清除當前會話
      return;
    }

    const domainList = domains.split(','); // 分割域名
    const uri = UserAgent.makeURI(`sip:${username}@${domainList[0]}`); // 創建 SIP URI
    if (!uri) {
      setCallState("無法創建URI");
      return;
    }

    // 創建 UserAgent
    const ua = new UserAgent({
      uri,
      displayName,
      authorizationUsername: username,
      authorizationPassword: password,
      transportOptions: {
        server: wsServer,
      },
    });

    setUserAgent(ua);

    try {
      await ua.start(); // 啟動 UserAgent
      const targetURI = UserAgent.makeURI(`sip:${callToNumber ? callToNumber : callNumber}@${domainList[0]}`); // 創建目標 URI
      if (!targetURI) {
        setCallState("無法創建目標URI");
        return;
      }

      const inviter = new Inviter(ua, targetURI); // 創建 Inviter
      setCurrentSession(inviter);

      // 監聽狀態改變
      inviter.stateChange.addListener((state) => {
        if (state === SessionState.Establishing) {
          setCallState("正在建立連接...");
        } else if (state === SessionState.Established) {
          setCallState("通話中");
          // 停止播放音檔
          if (ringbackAudioRef.current) {
            ringbackAudioRef.current.pause();
            ringbackAudioRef.current.currentTime = 0;
          }

          const audioElement = document.getElementById('remoteAudio') as HTMLAudioElement;
          if (audioElement) {
            const remoteStream = new MediaStream();
            if (inviter.sessionDescriptionHandler) {
              (inviter.sessionDescriptionHandler as unknown as { peerConnection: RTCPeerConnection }).peerConnection.getReceivers().forEach((receiver: { track: MediaStreamTrack; }) => {
                if (receiver.track) {
                  remoteStream.addTrack(receiver.track);
                }
              });
            }
            audioElement.srcObject = remoteStream;
            audioElement.play();
          }
        } else if (state === SessionState.Terminated) {
          setCallState("通話已終止");
          setTimeout(() => {
            setCallState('');
            setCallNumber('');
          }, 1500)
          // 停止播放音檔
          if (ringbackAudioRef.current) {
            ringbackAudioRef.current.pause();
            ringbackAudioRef.current.currentTime = 0;
          }
          setCurrentSession(null);
        }
      });

      // 撥打電話時播放音檔
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current.play();
      }

      await inviter.invite(); // 發起呼叫
      setCallState("撥號中...");
    } catch (error) {
      console.error("呼叫失敗", error);
      setCallState("呼叫失敗");
      setTimeout(() => {
        setCallState('');
        setCallNumber('');
      }, 1500)
    }
  };

  return (
    <>
      <form id="callForm" onSubmit={handleCall}>
        <h2 className='callNumber'>{!callNumber ? '請輸入撥打號碼' : callState ? callState : callNumber}</h2>
        <div className="dial-pad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => setCallNumber((prev) => prev + digit)}
              disabled={callState ? true : false}
            >
              {digit}
            </button>
          ))}
        </div>

        <div className="control-buttons">
          <button 
            type="button" 
            onClick={() => setCallNumber('')} 
            style={{ backgroundColor: '#ef4444', display: !callState ? 'block' : 'none'}}
          >
              清空
          </button>
          <button 
            type="submit"
            style={{ backgroundColor: currentSession ? '#ef4444' : '#0ea5e9'}}
          >
            {currentSession ? '掛斷' : '撥打'}
          </button>
          <button 
            type="button"
            onClick={() => setCallNumber((prev) => prev.slice(0, -1))}
            style={{ backgroundColor: '#eab308', display: !callState ? 'block' : 'none'}}
          >
            訂正
          </button>
        </div>
        <hr />
        <button style={{ marginTop: '6px' }} type="button" onClick={(e)=>handleCall(e, '0915970815')}>撥打到 Leo</button>
      </form>

      <audio id="remoteAudio" autoPlay></audio>
      <audio ref={ringbackAudioRef} src="/src/assets/ringbacktone.mp3" loop></audio>
    </>
  );
}

export default App;