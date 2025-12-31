import React from 'react';
import Header from '../components/Header';
import policyImg from '../assets/policy.jpg';
import './TermsPage.css';

function TermsPage({ user, onLogout, onCreatePost }) {
  return (
    <div className="terms-page">
      <Header user={user} onLogout={onLogout} onCreatePost={onCreatePost} />
      <div className="terms-container">
        <h1>Raddit 用户协议与隐私政策</h1>
        <div className="terms-header-image" style={{ textAlign: 'center' }}>
          <img src={policyImg} alt="Policy" style={{ maxWidth: '200px', height: 'auto', borderRadius: '4px', marginBottom: '20px' }} />
        </div>
        <div className="terms-content">
          <section>
            <h2>1. 总则</h2>
            <p>欢迎使用 Raddit。<strong>您在 Raddit 进行注册、登录、发帖、回复或使用任何服务，即视为您已阅读并完全同意本协议的所有条款。</strong>如果您不同意本协议的任何内容，请立即停止使用本服务。</p>
          </section>
          
          <section>
            <h2>2. 用户言论与责任</h2>
            <p>Raddit 致力于提供一个自由开放的交流平台，但用户必须对自己在平台上的所有行为和言论承担全部法律责任。</p>
            <ul>
                <li>用户承诺发布的内容符合其所在地及国籍所属国的相关法律法规。</li>
                <li><strong>风险提示：</strong>对于涉及政治、时事、宗教等敏感话题的讨论，用户应充分知晓并自行承担可能带来的所有风险（包括但不限于法律调查、起诉、人身安全风险等）。</li>
                <li><strong>Raddit 不对用户因发布此类内容而遭受的任何现实后果承担责任。发布即代表您愿意自负风险。</strong></li>
                <li>用户不得发布包含暴力、色情、骚扰、仇恨言论或侵犯他人隐私的内容。</li>
            </ul>
          </section>

          <section>
            <h2>3. 免责声明</h2>
            <p>Raddit 仅提供信息存储空间服务，不对用户发布内容的真实性、准确性或立场负责。用户的言论仅代表其个人观点，不代表 Raddit 的立场。</p>
            <p>Raddit 不保证服务不会中断，也不保证服务的绝对安全性。虽然我们采取了加密措施，但用户应知晓网络传输存在的潜在风险。</p>
            <p>对于因不可抗力、黑客攻击、系统不稳定或政府管制等原因导致的数据丢失、泄露或服务中断，Raddit 不承担赔偿责任。</p>
          </section>

          <section>
            <h2>4. 隐私政策</h2>
            <p>我们尊重并保护所有用户的个人隐私权。为了提供服务，我们会收集您的部分必要信息（如 Google 登录授权的基本信息）。</p>
            <p>未经您同意，我们不会向第三方公开或透露您的个人信息，但法律法规另有规定或为了配合司法程序的情况除外。</p>
          </section>
          
          <section>
            <h2>5. 协议修改</h2>
            <p>Raddit 保留随时修改本协议的权利。修改后的协议一旦公布即有效代替原来的协议。您继续使用本服务即视为您接受修改后的协议。</p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default TermsPage;
