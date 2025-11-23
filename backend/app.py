# app.py
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from bson import ObjectId
from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required,
    get_jwt_identity, get_jwt
)
from datetime import timedelta
import logging

#Configurações básicas
app = Flask(__name__)
CORS(app)

app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "dev_jwt_secret_change_me")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=8)
jwt = JWTManager(app)

#Logging básico
logging.basicConfig(level=logging.INFO)

#MongoDB URI via env var
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGO_URI)
db = client['esdb']

users_collection = db['users']
classes_collection = db['classes']
subjects_collection = db['subjects']
scores_collection = db['scores']

#Dados iniciais
initial_classes = [
    {"turma": "101M", "periodo": "manhã"},
    {"turma": "102M", "periodo": "manhã"},
    {"turma": "103M", "periodo": "manhã"},
    {"turma": "201M", "periodo": "manhã"},
    {"turma": "202M", "periodo": "manhã"},
    {"turma": "203M", "periodo": "manhã"},
    {"turma": "301M", "periodo": "manhã"},
    {"turma": "302M", "periodo": "manhã"},
    {"turma": "303M", "periodo": "manhã"},
    {"turma": "101T", "periodo": "tarde"},
    {"turma": "102T", "periodo": "tarde"},
    {"turma": "103T", "periodo": "tarde"},
    {"turma": "201T", "periodo": "tarde"},
    {"turma": "202T", "periodo": "tarde"},
    {"turma": "203T", "periodo": "tarde"},
    {"turma": "301T", "periodo": "tarde"},
    {"turma": "302T", "periodo": "tarde"},
    {"turma": "303T", "periodo": "tarde"}
]

initial_subjects = [
    {"nome": "Matemática"},
    {"nome": "Português"},
    {"nome": "Inglês"},
    {"nome": "Ciências"},
    {"nome": "História"},
    {"nome": "Geografia"},
    {"nome": "Artes"},
    {"nome": "Educação Física"}
]

initial_users = [
    {
        "username": "admin",
        "password": generate_password_hash("admin123"),
        "role": "admin"
    },
    {
        "username": "aluno",
        "password": generate_password_hash("aluno123"),
        "role": "student",
        "class": "101M"
    },
    {
        "username": "professor",
        "password": generate_password_hash("prof123"),
        "role": "teacher",
        "subject": "Matemática"
    }
]

#Utilitários
def ensure_indexes():
    try:
        users_collection.create_index("username", unique=True)
        scores_collection.create_index("student", unique=True)
        logging.info("Índices verificados/criados.")
    except Exception as e:
        logging.exception("Erro criando índices: %s", e)

def objectid_to_str(obj):
    if isinstance(obj, dict):
        new = {}
        for k, v in obj.items():
            if isinstance(v, ObjectId):
                new[k] = str(v)
            else:
                new[k] = objectid_to_str(v)
        return new
    elif isinstance(obj, list):
        return [objectid_to_str(item) for item in obj]
    else:
        return obj

def serialize_doc(doc):
    if not doc:
        return doc
    doc_copy = dict(doc)
    if "_id" in doc_copy:
        doc_copy["_id"] = str(doc_copy["_id"])
    return objectid_to_str(doc_copy)

def class_exists(name):
    return classes_collection.find_one({"turma": name}) is not None

def subject_exists(name):
    return subjects_collection.find_one({"nome": name}) is not None

#Inicialização do banco (ordem corrigida)
def initialize_database():
    ensure_indexes()

    #Inserir turmas e matérias
    if classes_collection.count_documents({}) == 0:
        classes_collection.insert_many(initial_classes)
        logging.info("Dados iniciais de turmas inseridos.")
    else:
        logging.info("Dados de turmas já existentes.")

    if subjects_collection.count_documents({}) == 0:
        subjects_collection.insert_many(initial_subjects)
        logging.info("Dados iniciais de matérias inseridos.")
    else:
        logging.info("Dados de matérias já existentes.")

    #Inserir usuários padrão se não existirem (antes dos scores)
    for user in initial_users:
        if not users_collection.find_one({"username": user["username"]}):
            users_collection.insert_one(user)
            logging.info("Usuário inicial '%s' criado.", user["username"])
        else:
            logging.info("Usuário '%s' já existe.", user["username"])

    #Inserir scores para aluno padrão se coleção de scores vazia
    if scores_collection.count_documents({}) == 0:
        student = users_collection.find_one({"username": "aluno", "role": "student"})
        if student:
            initial_scores = {
                "student": student["_id"],
                "scores": {
                    "Matemática": [7, 7, 8, 8.5],
                    "Português": [8, 7.5, 7, 8],
                    "Inglês": [9, 9.5, 9, 10],
                    "Ciências": [6.5, 7, 7, 8],
                    "História": [7, 8, 7.5, 7],
                    "Geografia": [5, 7, 7.5, 7.5],
                    "Artes": [10, 10, 10, 9.5],
                    "Educação Física": [8, 7, 8, 9]
                }
            }
            scores_collection.insert_one(initial_scores)
            logging.info("Dados iniciais de notas inseridos para o aluno.")
        else:
            logging.warning("Nenhum aluno encontrado para associar as notas iniciais.")
    else:
        logging.info("Dados de notas já existentes.")

#Rotas públicas / básicas
@app.route('/')
def home():
    return "API do Flask está funcionando!"

@app.route('/register', methods=['POST'])
def register():
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')
    role = data.get('role')  #"student", "teacher", "admin"
    student_class = data.get('class')
    subject = data.get('subject')

    if not username or not password or not role:
        return jsonify({"error": "Todos os campos são obrigatórios!", "code": "INVALID_INPUT"}), 400

    if users_collection.find_one({"username": username}):
        return jsonify({"error": "Usuário já existe!", "code": "USER_EXISTS"}), 400

    # Validação
    if role == 'student':
        if not student_class or not class_exists(student_class):
            return jsonify({"error": "Turma inexistente!", "code": "INVALID_CLASS"}), 400
    elif role == 'teacher':
        if not subject or not subject_exists(subject):
            return jsonify({"error": "Matéria inexistente!", "code": "INVALID_SUBJECT"}), 400

    hashed_password = generate_password_hash(password)
    user_data = {
        "username": username,
        "password": hashed_password,
        "role": role
    }
    if role == 'student':
        user_data['class'] = student_class
    elif role == 'teacher':
        user_data['subject'] = subject

    inserted = users_collection.insert_one(user_data)

    #Criar scores iniciais para aluno
    if role == 'student':
        initial_scores = {
            "student": inserted.inserted_id,
            "scores": { s["nome"]: [None, None, None, None] for s in initial_subjects }
        }
        scores_collection.insert_one(initial_scores)

    return jsonify({"message": "Registro feito com sucesso!"}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Todos os campos são obrigatórios!", "code": "INVALID_INPUT"}), 400

    user = users_collection.find_one({"username": username})
    if not user or not check_password_hash(user['password'], password):
        return jsonify({"error": "Credenciais inválidas!", "code": "INVALID_CREDENTIALS"}), 401

    access_token = create_access_token(identity=str(user["_id"]), additional_claims={"role": user.get("role")})
    user_dto = serialize_doc(user)
    user_dto.pop("password", None)
    return jsonify({"access_token": access_token, "user": user_dto}), 200

#Rotas públicas de listagem
@app.route('/api/classes', methods=['GET'])
def list_classes():
    classes = list(classes_collection.find())
    classes = [serialize_doc(c) for c in classes]
    return jsonify(classes), 200

@app.route('/api/subjects', methods=['GET'])
def list_subjects():
    subjects = list(subjects_collection.find())
    subjects = [serialize_doc(s) for s in subjects]
    return jsonify(subjects), 200

@app.route('/api/students', methods=['GET'])
@jwt_required(optional=True)
def list_students():
    students = list(users_collection.find({"role": "student"}))
    students = [serialize_doc(s) for s in students]
    for s in students:
        s.pop('password', None)
    return jsonify(students), 200

@app.route('/api/scores', methods=['GET'])
@jwt_required(optional=True)
def list_scores():
    try:
        scores = list(scores_collection.find())
        scores = [serialize_doc(score) for score in scores]
        return jsonify(scores), 200
    except Exception as e:
        logging.exception("Erro list_scores: %s", e)
        return jsonify({"error": str(e)}), 500

#Atualizar notas
@app.route('/api/scores/<student_id>', methods=['PATCH'])
@jwt_required()
def patch_scores(student_id):
    try:
        claims = get_jwt()
        caller_role = claims.get("role")
        caller_id = get_jwt_identity()

        data = request.get_json() or {}
        subject = data.get("subject")
        new_scores = data.get("scores")

        if not subject or not isinstance(new_scores, list):
            return jsonify({"error": "Payload inválido", "code": "INVALID_PAYLOAD"}), 400

        #Validação de valores
        if len(new_scores) > 4 or any((s is not None and (not isinstance(s, (int, float)) or s < 0 or s > 10)) for s in new_scores):
            return jsonify({"error": "Notas inválidas", "code": "INVALID_SCORES"}), 400

        #Se caller é teacher, verificar que leciona essa matéria
        if caller_role == "teacher":
            teacher = users_collection.find_one({"_id": ObjectId(caller_id)})
            if not teacher or teacher.get("subject") != subject:
                return jsonify({"error": "Você não leciona essa matéria", "code": "FORBIDDEN"}), 403

        #Se caller é student, negar atualização
        if caller_role == "student":
            return jsonify({"error": "Permissão negada para estudantes", "code": "FORBIDDEN"}), 403

        result = scores_collection.update_one(
            {"student": ObjectId(student_id)},
            {"$set": {f"scores.{subject}": new_scores}}
        )
        if result.matched_count == 0:
            return jsonify({"error": "Estudante não encontrado", "code": "NOT_FOUND"}), 404

        return jsonify({"message": "Notas atualizadas com sucesso!"}), 200

    except Exception as e:
        logging.exception("Erro patch_scores: %s", e)
        return jsonify({"error": str(e)}), 500

@app.route('/api/update_scores/<student_id>', methods=['PUT'])
@jwt_required()
def update_single_subject_score(student_id):
    return patch_scores(student_id)

#Rotas restritas para admin (criar matérias e turmas)
@app.route('/api/subjects', methods=['POST'])
@jwt_required()
def create_subject():
    claims = get_jwt()
    role = claims.get("role")
    if role != "admin":
        return jsonify({"error": "Acesso negado"}), 403

    data = request.get_json() or {}
    nome = data.get("nome")
    if not nome:
        return jsonify({"error": "Campo 'nome' é obrigatório"}), 400
    if subject_exists(nome):
        return jsonify({"error": "Matéria já existe"}), 400

    subjects_collection.insert_one({"nome": nome})
    return jsonify({"message": "Matéria criada"}), 201

@app.route('/api/classes', methods=['POST'])
@jwt_required()
def create_class():
    claims = get_jwt()
    role = claims.get("role")
    if role != "admin":
        return jsonify({"error": "Acesso negado"}), 403

    data = request.get_json() or {}
    turma = data.get("turma")
    periodo = data.get("periodo")
    if not turma or not periodo:
        return jsonify({"error": "Campos 'turma' e 'periodo' são obrigatórios"}), 400
    if class_exists(turma):
        return jsonify({"error": "Turma já existe"}), 400

    classes_collection.insert_one({"turma": turma, "periodo": periodo})
    return jsonify({"message": "Turma criada"}), 201

#Inicializa e roda
if __name__ == '__main__':
    initialize_database()
    app.run(debug=True)
