// src/components/Class.js
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { listStudents, listScores, updateScores, listSubjects } from '../services/api';
import Modal from './Modal';
import './Class.css';

function Class() {
  const location = useLocation();
  const { classInfo: stateClassInfo, subject: stateSubject } = location.state || {};
  const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
  const userRole = storedUser?.role || null;

  // For teachers: classInfo & subject (teacher's subject) flow as before
  const classInfo = stateClassInfo || (storedUser ? storedUser.class && { turma: storedUser.class } : null);
  const subject = stateSubject || storedUser?.subject || null;

  const [filteredStudents, setFilteredStudents] = useState([]);
  const [filteredScores, setFilteredScores] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // --- ADMIN state
  const [subjectsList, setSubjectsList] = useState([]);
  const [adminSelectedSubject, setAdminSelectedSubject] = useState(null); // subject chosen by admin to view
  const [adminSubjectStudentRows, setAdminSubjectStudentRows] = useState([]); // rows to display for admin view

  useEffect(() => {
    if (!classInfo) return;

    // If admin: fetch subjects and students; prepare view when adminSelectedSubject chosen
    if (userRole === 'admin') {
      const fetchAdminData = async () => {
        try {
          const subs = await listSubjects();
          setSubjectsList(subs || []);

          const students = await listStudents();
          const filtered = students.filter(student => student.class === classInfo.turma);
          setFilteredStudents(filtered);

          const scoresData = await listScores();
          setFilteredScores(scoresData || []);
        } catch (error) {
          console.error('Erro ao buscar dados para admin:', error);
        }
      };
      fetchAdminData();
      return;
    }

    // If teacher or other: existing behavior (teacher flow unchanged)
    if (!subject) return;

    const fetchStudentsAndScores = async () => {
      try {
        const students = await listStudents();
        const filtered = students.filter(student => student.class === classInfo.turma);
        setFilteredStudents(filtered);

        const scoresData = await listScores();
        const studentIds = filtered.map(student => student._id);

        const filteredScores = (scoresData || [])
          .filter(score => studentIds.includes(score.student))
          .map(score => ({
            studentId: score.student,
            subjectScore: (score.scores && score.scores[subject]) ? score.scores[subject] : [null, null, null, null]
          }));

        setFilteredScores(filteredScores);
      } catch (error) {
        console.error('Erro ao buscar alunos ou scores:', error);
      }
    };

    fetchStudentsAndScores();
  }, [classInfo?.turma, subject, userRole]);

  // When admin selects a subject, build the rows (students + their score in that subject)
  useEffect(() => {
    if (userRole !== 'admin' || !adminSelectedSubject) {
      setAdminSubjectStudentRows([]);
      return;
    }

    // build rows using filteredStudents and filteredScores
    const rows = filteredStudents.map(student => {
      const scoreDoc = filteredScores.find(s => s.student === student._id);
      const subjectArr = scoreDoc && scoreDoc.scores ? scoreDoc.scores[adminSelectedSubject] : null;
      const scoresArray = Array.isArray(subjectArr) ? subjectArr : [null, null, null, null];
      return {
        studentId: student._id,
        username: student.username,
        scores: scoresArray
      };
    });
    setAdminSubjectStudentRows(rows);
  }, [adminSelectedSubject, filteredStudents, filteredScores, userRole]);

  if (!classInfo) {
    return <div>Turma não encontrada.</div>;
  }

  // helper for teacher view
  const getStudentScores = (studentId) => {
    const score = filteredScores.find(s => s.studentId === studentId || s.student === studentId);
    return score ? (score.subjectScore || [null, null, null, null]) : [null, null, null, null];
  };

  const handleEditScores = (student) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  const handleSaveScores = async (studentId, newScores) => {
    try {
      await updateScores(studentId, subject, newScores);
      setFilteredScores(prevScores => 
        prevScores.map(score =>
          score.studentId === studentId ? { ...score, subjectScore: newScores } : score
        )
      );
    } catch (error) {
      console.error('Erro ao atualizar as notas:', error);
      alert('Erro ao atualizar notas: ' + (error.message || 'Erro desconhecido'));
    }
  };

  // Admin UI: list subjects, then show table with students and their note on selected subject
  if (userRole === 'admin') {
    return (
      <div className="class-container">
        <h1>Turma: {classInfo.turma}</h1>
        <h2>Visão do Admin (leitura)</h2>

        <div className="admin-subjects-section">
          <h3>Matérias disponíveis</h3>
          {subjectsList.length > 0 ? (
            <div className="admin-subjects-list">
              {subjectsList.map((sub) => (
                <button
                  key={sub._id}
                  className={`admin-subject-button ${adminSelectedSubject === sub.nome ? 'selected' : ''}`}
                  onClick={() => setAdminSelectedSubject(sub.nome)}
                >
                  {sub.nome}
                </button>
              ))}
            </div>
          ) : (
            <p>Carregando matérias...</p>
          )}
        </div>

        {adminSelectedSubject && (
          <div className="admin-subject-scores">
            <h3>Matéria: {adminSelectedSubject}</h3>
            {adminSubjectStudentRows.length > 0 ? (
              <table className="admin-scores-table">
                <thead>
                  <tr>
                    <th>Aluno</th>
                    <th>Nota 1</th>
                    <th>Nota 2</th>
                    <th>Nota 3</th>
                    <th>Nota 4</th>
                    <th>Média</th>
                  </tr>
                </thead>
                <tbody>
                  {adminSubjectStudentRows.map(row => {
                    const valid = row.scores.filter(s => s !== null);
                    const avg = valid.length > 0 ? (valid.reduce((a,b) => a + b, 0) / valid.length).toFixed(2) : 'Sem nota';
                    return (
                      <tr key={row.studentId}>
                        <td>{row.username}</td>
                        {row.scores.map((sc, i) => <td key={i}>{sc !== null ? sc : 'Sem nota'}</td>)}
                        {Array.from({ length: Math.max(0, 4 - row.scores.length) }).map((_, idx) => <td key={`e-${idx}`}>Sem nota</td>)}
                        <td>{avg}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p>Não há alunos ou notas para esta turma/matéria.</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Non-admin (teacher) view: unchanged behaviour (teacher can edit only his subject)
  return (
    <div className="class-container">
      <h1>Detalhes da Turma: {classInfo.turma}</h1>
      <h2>Matéria: {subject}</h2>
      <h3>Alunos e Notas:</h3>
      {filteredStudents.length > 0 ? (
        <ul>
          {filteredStudents.map((student) => (
            <li key={student._id}>
              {student.username}
              <div className="scores-container">
                {getStudentScores(student._id).map((score, i) => (
                  <label key={i} className="score-item">
                    {score !== null ? score : 'Sem nota'}
                  </label>
                ))}
                <button className="edit-button" onClick={() => handleEditScores(student)}>
                  Editar
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>Não há alunos cadastrados para esta turma.</p>
      )}

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        student={selectedStudent} 
        initialScores={selectedStudent ? getStudentScores(selectedStudent._id) : [null, null, null, null]}
        onSave={handleSaveScores}
      />
    </div>
  );
}

export default Class;
