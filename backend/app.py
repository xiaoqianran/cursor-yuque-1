# ========== 导入必要的库 ==========
from flask import Flask, jsonify, request, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os

# ========== 创建 Flask 应用 ==========
app = Flask(__name__)

# ========== 配置数据库 ==========
# 获取项目根目录
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
# 数据库文件路径
DB_PATH = os.path.join(os.path.dirname(BASE_DIR), 'database', 'documents.db')
# 确保 database 目录存在
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

# 配置 SQLite 数据库
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{DB_PATH}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JSON_AS_ASCII'] = False  # 支持中文

# 初始化数据库
db = SQLAlchemy(app)

print('=' * 50)
print('📚 文档系统后端启动中...')
print(f'📁 数据库路径: {DB_PATH}')
print('=' * 50)

# ========== 定义数据模型 ==========

class Folder(db.Model):
    """文件夹模型"""
    __tablename__ = 'folders'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('folders.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关联关系
    children = db.relationship('Folder', backref=db.backref('parent', remote_side=[id]))
    documents = db.relationship('Document', backref='folder', lazy=True)
    
    def to_dict(self, include_children=False):
        """将对象转换为字典"""
        result = {
            'id': self.id,
            'name': self.name,
            'parent_id': self.parent_id,
            'createdAt': self.created_at.isoformat(),
            'updatedAt': self.updated_at.isoformat(),
            'type': 'folder'
        }
        
        if include_children:
            result['children'] = [child.to_dict(True) for child in self.children]
            result['documents'] = [doc.to_dict() for doc in self.documents]
        
        return result
    
    def __repr__(self):
        return f'<Folder {self.id}: {self.name}>'


class Document(db.Model):
    """文档模型"""
    __tablename__ = 'documents'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, default='')
    folder_id = db.Column(db.Integer, db.ForeignKey('folders.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """将对象转换为字典"""
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'folder_id': self.folder_id,
            'createdAt': self.created_at.isoformat(),
            'updatedAt': self.updated_at.isoformat(),
            'type': 'document'
        }
    
    def __repr__(self):
        return f'<Document {self.id}: {self.title}>'

# ========== 创建数据库表 ==========
with app.app_context():
    db.create_all()
    print('✅ 数据库表创建成功！')

# ========== 静态文件路由 ==========
@app.route('/')
def index():
    """返回前端页面"""
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    """返回静态文件（CSS、JS等）"""
    return send_from_directory('../frontend', path)

# ========== 文件夹 API ==========

@app.route('/api/folders', methods=['GET'])
def get_folders():
    """获取文件夹树形结构"""
    try:
        # 获取所有根文件夹（没有父文件夹的）
        root_folders = Folder.query.filter_by(parent_id=None).all()
        
        folders_tree = [folder.to_dict(include_children=True) for folder in root_folders]
        
        print(f'📁 获取文件夹树: {len(root_folders)} 个根文件夹')
        
        return jsonify({
            'success': True,
            'data': folders_tree
        })
    except Exception as e:
        print(f'❌ 获取文件夹失败: {str(e)}')
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@app.route('/api/folders', methods=['POST'])
def create_folder():
    """创建文件夹"""
    try:
        data = request.get_json()
        
        if not data or not data.get('name'):
            return jsonify({
                'success': False,
                'message': '文件夹名称不能为空'
            }), 400
        
        new_folder = Folder(
            name=data['name'],
            parent_id=data.get('parent_id')
        )
        
        db.session.add(new_folder)
        db.session.commit()
        
        print(f'✅ 创建文件夹成功: {new_folder.name}')
        
        return jsonify({
            'success': True,
            'data': new_folder.to_dict(),
            'message': '文件夹创建成功'
        }), 201
    except Exception as e:
        db.session.rollback()
        print(f'❌ 创建文件夹失败: {str(e)}')
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@app.route('/api/folders/<int:folder_id>', methods=['PUT'])
def update_folder(folder_id):
    """更新文件夹"""
    try:
        folder = db.session.get(Folder, folder_id)
        
        if not folder:
            return jsonify({
                'success': False,
                'message': '文件夹不存在'
            }), 404
        
        data = request.get_json()
        
        if 'name' in data:
            folder.name = data['name']
        
        folder.updated_at = datetime.utcnow()
        db.session.commit()
        
        print(f'✅ 更新文件夹成功: {folder.name}')
        
        return jsonify({
            'success': True,
            'data': folder.to_dict(),
            'message': '文件夹更新成功'
        })
    except Exception as e:
        db.session.rollback()
        print(f'❌ 更新文件夹失败: {str(e)}')
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@app.route('/api/folders/<int:folder_id>', methods=['DELETE'])
def delete_folder(folder_id):
    """删除文件夹"""
    try:
        folder = db.session.get(Folder, folder_id)
        
        if not folder:
            return jsonify({
                'success': False,
                'message': '文件夹不存在'
            }), 404
        
        # 检查是否有子文件夹或文档
        if folder.children or folder.documents:
            return jsonify({
                'success': False,
                'message': '文件夹不为空，无法删除'
            }), 400
        
        folder_name = folder.name
        db.session.delete(folder)
        db.session.commit()
        
        print(f'✅ 删除文件夹成功: {folder_name}')
        
        return jsonify({
            'success': True,
            'message': '文件夹删除成功'
        })
    except Exception as e:
        db.session.rollback()
        print(f'❌ 删除文件夹失败: {str(e)}')
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

# ========== 文档 API（更新版）==========

@app.route('/api/documents', methods=['GET'])
def get_documents():
    """获取所有文档列表"""
    try:
        folder_id = request.args.get('folder_id', type=int)
        
        if folder_id is not None:
            # 获取指定文件夹下的文档
            documents = Document.query.filter_by(folder_id=folder_id).order_by(Document.updated_at.desc()).all()
        else:
            # 获取所有文档
            documents = Document.query.order_by(Document.updated_at.desc()).all()
        
        docs_list = [doc.to_dict() for doc in documents]
        
        print(f'📋 获取文档列表: {len(docs_list)} 个文档')
        
        return jsonify({
            'success': True,
            'data': docs_list,
            'total': len(docs_list)
        })
    except Exception as e:
        print(f'❌ 获取文档列表失败: {str(e)}')
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@app.route('/api/documents/<int:doc_id>', methods=['GET'])
def get_document(doc_id):
    """获取指定 ID 的文档"""
    try:
        document = db.session.get(Document, doc_id)
        
        if not document:
            return jsonify({
                'success': False,
                'message': '文档不存在'
            }), 404
        
        print(f'📄 获取文档: {document.title}')
        
        return jsonify({
            'success': True,
            'data': document.to_dict()
        })
    except Exception as e:
        print(f'❌ 获取文档失败: {str(e)}')
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@app.route('/api/documents', methods=['POST'])
def create_document():
    """创建新文档"""
    try:
        data = request.get_json()
        
        if not data or not data.get('title'):
            return jsonify({
                'success': False,
                'message': '标题不能为空'
            }), 400
        
        new_doc = Document(
            title=data['title'],
            content=data.get('content', f"# {data['title']}\n\n开始编写你的内容..."),
            folder_id=data.get('folder_id')
        )
        
        db.session.add(new_doc)
        db.session.commit()
        
        print(f'✅ 创建文档成功: {new_doc.title}')
        
        return jsonify({
            'success': True,
            'data': new_doc.to_dict(),
            'message': '文档创建成功'
        }), 201
    except Exception as e:
        db.session.rollback()
        print(f'❌ 创建文档失败: {str(e)}')
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@app.route('/api/documents/<int:doc_id>', methods=['PUT'])
def update_document(doc_id):
    """更新文档内容"""
    try:
        document = db.session.get(Document, doc_id)
        
        if not document:
            return jsonify({
                'success': False,
                'message': '文档不存在'
            }), 404
        
        data = request.get_json()
        
        if 'title' in data:
            document.title = data['title']
        if 'content' in data:
            document.content = data['content']
        if 'folder_id' in data:
            document.folder_id = data['folder_id']
        
        document.updated_at = datetime.utcnow()
        db.session.commit()
        
        print(f'✅ 更新文档成功: {document.title}')
        
        return jsonify({
            'success': True,
            'data': document.to_dict(),
            'message': '文档更新成功'
        })
    except Exception as e:
        db.session.rollback()
        print(f'❌ 更新文档失败: {str(e)}')
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@app.route('/api/documents/<int:doc_id>', methods=['DELETE'])
def delete_document(doc_id):
    """删除文档"""
    try:
        document = db.session.get(Document, doc_id)
        
        if not document:
            return jsonify({
                'success': False,
                'message': '文档不存在'
            }), 404
        
        doc_title = document.title
        db.session.delete(document)
        db.session.commit()
        
        print(f'✅ 删除文档成功: {doc_title}')
        
        return jsonify({
            'success': True,
            'message': '文档删除成功'
        })
    except Exception as e:
        db.session.rollback()
        print(f'❌ 删除文档失败: {str(e)}')
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

# ========== 获取完整树形结构 ==========
@app.route('/api/tree', methods=['GET'])
def get_tree():
    """获取完整的文件夹和文档树"""
    try:
        # 获取所有根文件夹
        root_folders = Folder.query.filter_by(parent_id=None).all()
        tree = [folder.to_dict(include_children=True) for folder in root_folders]
        
        # 获取没有文件夹的文档（根目录文档）
        root_documents = Document.query.filter_by(folder_id=None).order_by(Document.updated_at.desc()).all()
        root_docs = [doc.to_dict() for doc in root_documents]
        
        print(f'🌲 获取树形结构: {len(root_folders)} 个文件夹, {len(root_docs)} 个根文档')
        
        return jsonify({
            'success': True,
            'data': {
                'folders': tree,
                'documents': root_docs
            }
        })
    except Exception as e:
        print(f'❌ 获取树形结构失败: {str(e)}')
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

# ========== 启动应用 ==========
if __name__ == '__main__':
    print('🚀 服务器启动成功！')
    print('📍 访问地址: http://127.0.0.1:5000')
    print('=' * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)
