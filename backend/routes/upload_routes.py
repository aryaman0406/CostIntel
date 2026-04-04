from flask import Blueprint, request
from werkzeug.utils import secure_filename
import os
import tempfile
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.expense_service import create_expense_from_csv

upload_bp = Blueprint('upload', __name__)

@upload_bp.route('/upload-csv', methods=['POST'])
@jwt_required()
def upload_csv():
    if 'file' not in request.files:
        return {'error': 'No file part'}, 400
    file = request.files['file']
    if file.filename == '':
        return {'error': 'No selected file'}, 400
    if file:
        filename = secure_filename(file.filename)
        filepath = os.path.join(tempfile.gettempdir(), filename)
        file.save(filepath)
        
        # Get user_id from JWT token
        user_id = get_jwt_identity()
        
        try:
            create_expense_from_csv(filepath, user_id)
            return {'message': 'File uploaded and processed successfully'}, 200
        except Exception as e:
            return {'error': str(e)}, 500
    return {'error': 'File upload failed'}, 500