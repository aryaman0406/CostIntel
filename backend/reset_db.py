import os
from app import create_app
from extensions import db

app = create_app()

with app.app_context():
    print("Dropping all tables...")
    db.drop_all()
    print("Creating all tables...")
    db.create_all()
    print("Re-evaluating default admin seed...")
    from app import seed_default_admin
    seed_default_admin()
    print("Done!")
