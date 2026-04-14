
from app.db import SessionLocal
from app import models, security
from app.config import settings

def seed_admin():
    db = SessionLocal()
    try:
        username = settings.ADMIN_DEFAULT_USERNAME
        password = settings.ADMIN_DEFAULT_PASSWORD
        
        existing = db.query(models.User).filter(models.User.username == username).first()
        if existing:
            print(f"Admin user '{username}' already exists.")
            return

        print(f"Creating admin user '{username}'...")
        
        admin_user = models.User(
            name="System Admin",
            username=username,
            email="admin@crimetracer.local",
            role=models.UserRole.ADMIN,
            password_hash=security.get_password_hash(password),
            is_active=True,
            station_id=None # Admins might not belong to a station
        )
        
        db.add(admin_user)
        db.commit()
        print(f"Successfully created admin user.")
        print(f"Username: {username}")
        print(f"Password: {password}")
        
    except Exception as e:
        print(f"Error seeding admin: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_admin()
