import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import loginGif from '../assets/login.gif';
import './LoginPage.css';

function LoginPage({ onGoogleCredential = () => {}, isAuthenticating = false, authError = '' }) {
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    document.title = '登录';
  }, []);

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      setLocalError('未获取到 Google 凭证');
      return;
    }
    try {
      setLocalError('');
      await onGoogleCredential(credentialResponse.credential);
    } catch (err) {
      setLocalError('登录失败，请稍后重试');
    }
  };

  return (
    <div className="login-page">
      <Link to="/" className="back-home-btn">
        ✕
      </Link>
      <div className="login-left">
        <div className="login-image-container">
          <img src={loginGif} alt="Login Animation" className="login-gif" />
        </div>
      </div>
      
      <div className="login-right">
        <div className="login-content">
          <h1 className="login-title">Happening now</h1>
          <h2 className="login-subtitle">Join today.</h2>
          
          <div className="login-buttons">
            <div className="google-login-wrapper">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setLocalError('Google 登录失败，请重试')}
                shape="pill"
                width="280"
                locale="zh-CN"
              />
            </div>
            {(authError || localError) && (
              <p className="login-error">{authError || localError}</p>
            )}
            {isAuthenticating && <p className="login-hint">正在登录...</p>}
            
            <p className="login-terms">
              By signing up, you agree to the <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>, including <a href="#">Cookie Use</a>.
            </p>
          </div>
          
          <div className="login-footer">
            <h3>Already have an account?</h3>
            <button className="login-btn sign-in-btn" disabled>
              使用 Google 登录
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;

