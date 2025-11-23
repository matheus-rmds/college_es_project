// src/components/Register.js
import React, { useEffect, useState } from 'react';
import './Register.css';
import { listClasses, listSubjects, register } from '../services/api';

function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const cls = await listClasses();
        setClasses(cls);
        const subs = await listSubjects();
        setSubjects(subs);
      } catch (error) {
        console.error('Error fetching classes/subjects:', error);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  useEffect(() => {
    setSelectedClass('');
    setSelectedSubject('');
  }, [role]);

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await register({
        username,
        password,
        role,
        class: role === 'student' ? selectedClass : undefined,
        subject: role === 'teacher' ? selectedSubject : undefined
      });
      alert('Registro feito com sucesso!');
      setUsername('');
      setPassword('');
      setRole('');
      setSelectedClass('');
      setSelectedSubject('');
    } catch (error) {
      alert('Erro ao registrar. ' + (error.message || 'Tente novamente.'));
    }
  };

  return (
    <div className="register-container">
      {loading ? (
        <p className="loading-message">Carregando...</p>
      ) : (
        <form className="register-form" onSubmit={handleRegister}>
          <h2 className="register-title">Registro</h2>
          <input
            type="text"
            placeholder="Nome"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="register-input"
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="register-input"
          />
          <select value={role} onChange={(e) => setRole(e.target.value)} required className="register-select">
            <option value="" disabled>Selecionar Opção</option>
            <option value="student">Aluno</option>
            <option value="teacher">Professor</option>
            <option value="admin">Admin</option>
          </select>
          {role === 'student' && (
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} required className="register-select">
              <option value="" disabled>Turma</option>
              {classes.map((cls) => (
                <option key={cls._id} value={cls.turma}>{cls.turma}</option>
              ))}
            </select>
          )}
          {role === 'teacher' && (
            <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} required className="register-select">
              <option value="" disabled>Matéria Ensinada</option>
              {subjects.map((subject) => (
                <option key={subject._id} value={subject.nome}>{subject.nome}</option>
              ))}
            </select>
          )}
          <button type="submit" className="register-button">Registrar</button>
        </form>
      )}
    </div>
  );
}

export default Register;
