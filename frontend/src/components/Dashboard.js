// src/components/Dashboard.js
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { listScores, listClasses } from '../services/api';
import './Dashboard.css';

function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialUser = location.state?.user || JSON.parse(localStorage.getItem('user') || 'null');
  const [user, setUser] = useState(initialUser);
  const [scores, setScores] = useState([]);
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchScores = async () => {
      try {
        const response = await listScores();
        const filteredScores = response.filter(scoreItem => scoreItem.student === user._id);
        setScores(filteredScores);
      } catch (error) {
        console.error('Erro ao buscar scores:', error);
      }
    };

    const fetchClasses = async () => {
      try {
        const response = await listClasses();
        setClasses(response);
      } catch (error) {
        console.error('Erro ao buscar turmas:', error);
      }
    };

    fetchScores();
    fetchClasses();
  }, [user, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleClassClick = (classInfo) => {
    // Mantemos comportamento: passamos classInfo; a Class component detecta o papel do usuário.
    // Para professores, a subject continua sendo user.subject (se existir).
    const userFromStorage = JSON.parse(localStorage.getItem('user') || 'null');
    const subject = userFromStorage?.subject || null;
    navigate('/class', { state: { classInfo, subject } });
  };

  const handleRegisterClick = () => {
    navigate('/register');
  };

  return (
    <div>
      <header className="dashboard-header">
        <h1 className="school-name">Escola</h1>
        <div>
          <div className="welcome-message">Bem-vindo(a), {user?.username}</div>
          <button onClick={handleLogout} className="logout-button">Sair</button>
        </div>
      </header>

      {user?.role === 'admin' && (
        <div className='admin-register-card' onClick={handleRegisterClick}>
          <h3>Acessar Tela de Registro</h3>
          <p>Clique aqui para registrar novos usuários.</p>
        </div>
      )}

      {user?.role === 'student' && (
        <div className='scores-div'>
          <h2 className='scoresTitle'>Notas</h2>
          <table className="scores-table">
            <thead>
              <tr>
                <th>Disciplina</th>
                <th>Nota 1</th>
                <th>Nota 2</th>
                <th>Nota 3</th>
                <th>Nota 4</th>
                <th>Média</th>
              </tr>
            </thead>
            <tbody>
              {scores.flatMap((scoreItem, index) =>
                Object.entries(scoreItem.scores || {}).map(([subject, sArr]) => {
                  const scoresArr = Array.isArray(sArr) ? sArr : [];
                  const validScores = scoresArr.filter(sc => sc !== null);
                  const average = validScores.length > 0 ? (validScores.reduce((sum, sc) => sum + sc, 0) / validScores.length).toFixed(2) : 'Sem nota';

                  return (
                    <tr key={`${subject}-${index}`}>
                      <td>{subject}</td>
                      {scoresArr.map((score, scoreIndex) => (
                        <td key={scoreIndex}>{score !== null ? score : 'Sem nota'}</td>
                      ))}
                      {Array.from({ length: Math.max(0, 4 - scoresArr.length) }).map((_, emptyIndex) => (
                        <td key={`empty-${emptyIndex}`}>Sem nota</td>
                      ))}
                      <td>{average}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {(user?.role === 'teacher' || user?.role === 'admin') && (
        <div>
          <h2 className='classTitle'>Turmas</h2>
          <div className="classes-container">
            {classes.length > 0 ? (
              classes.map((classItem) => (
                <div 
                  key={classItem._id} 
                  className="class-card" 
                  onClick={() => handleClassClick(classItem)}
                >
                  <h3>{classItem.turma}</h3>
                  <p>Período: {classItem.periodo}</p>
                </div>
              ))
            ) : (
              <p>Nenhuma turma encontrada.</p>
            )}
          </div>
        </div>
      )}
      <div className='footer-space'></div>    
    </div>
  );
}

export default Dashboard;
