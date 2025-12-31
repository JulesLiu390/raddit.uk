import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import notFoundImg from '../assets/404.jpg';
import './NotFoundPage.css';

function NotFoundPage({ user, onLogout, onCreatePost }) {
  const navigate = useNavigate();

  return (
    <div className="not-found-page">
      <Header user={user} onLogout={onLogout} onCreatePost={onCreatePost} />
      <div className="not-found-content">
        <img src={notFoundImg} alt="404 Not Found" className="not-found-image" />
        <h1>页面未找到</h1>
        <p>抱歉，您访问的页面不存在或已被删除。</p>
        <button className="not-found-back-btn" onClick={() => navigate('/')}>
          返回首页
        </button>
      </div>
    </div>
  );
}

export default NotFoundPage;
