import json
import os
import random
from datetime import datetime, timedelta
import bcrypt
import psycopg

PG_CONFIG = (
    f"host=localhost "
    f"port=5432 "
    f"user=postgres "
    f"password=postgres "
    f"dbname=postgres"
)

def get_db_connection():
    return psycopg.connect(PG_CONFIG)

def seed_data():
    print("🚀 Starting Data Seeding...")
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            print("🧹 Cleaning existing data...")
            cur.execute("TRUNCATE TABLE users, employees, performance_reviews, goals, training_records CASCADE;")
            
            # Admin
            admin_pass = bcrypt.hashpw(b"Admin@1234", bcrypt.gensalt()).decode()
            cur.execute("""
                INSERT INTO users (name, email, password_hash, role)
                VALUES (%s, %s, %s, %s) RETURNING id
            """, ("ACME Admin", "admin@acme.com", admin_pass, "admin"))
            print("✅ Created Admin")

            # 1 HR
            hr_pass = bcrypt.hashpw(b"HR@1234", bcrypt.gensalt()).decode()
            cur.execute("""
                INSERT INTO users (name, email, password_hash, role, department)
                VALUES (%s, %s, %s, %s, %s) RETURNING id
            """, ("Sarah Jenkins", "hr@acme.com", hr_pass, "hr", "Human Resources"))
            
            cur.execute("""
                INSERT INTO employees (name, email, department, job_title, hire_date, status)
                VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
            """, ("Sarah Jenkins", "hr@acme.com", "Human Resources", "HR Director", "2018-05-10", "active"))
            print("✅ Created HR Profile")

            # 5 Managers
            managers = [
                ("Michael Scott", "manager1@acme.com", "Engineering", "Engineering Manager"),
                ("Leslie Knope", "manager2@acme.com", "Product", "Product Lead"),
                ("Ron Swanson", "manager3@acme.com", "Operations", "Ops Director"),
                ("Harvey Specter", "manager4@acme.com", "Legal", "Chief Counsel"),
                ("Sheryl Sandberg", "manager5@acme.com", "Sales", "VP Sales")
            ]
            
            manager_ids = []
            manager_pass = bcrypt.hashpw(b"Manager@1234", bcrypt.gensalt()).decode()
            
            for name, email, dept, title in managers:
                cur.execute("""
                    INSERT INTO users (name, email, password_hash, role, department)
                    VALUES (%s, %s, %s, %s, %s) RETURNING id
                """, (name, email, manager_pass, "manager", dept))
                
                cur.execute("""
                    INSERT INTO employees (name, email, department, job_title, hire_date, status)
                    VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
                """, (name, email, dept, title, "2019-01-15", "active"))
                manager_ids.append(cur.fetchone()[0])
            print("✅ Created Managers")

            # 15 Employees
            emp_data = [
                ("Alice Johnson", "alice@acme.com", "Engineering", "Senior Dev"),
                ("Bob Smith", "bob@acme.com", "Engineering", "Dev Ops"),
                ("Charlie Brown", "charlie@acme.com", "Product", "UI Designer"),
                ("Diana Prince", "diana@acme.com", "Product", "QA lead"),
                ("Edward Norton", "edward@acme.com", "Operations", "Logistics"),
                ("Fiona Gallagher", "fiona@acme.com", "Operations", "Coordinator"),
                ("George Costanza", "george@acme.com", "Legal", "Associate"),
                ("Hannah Baker", "hannah@acme.com", "Legal", "Paralegal"),
                ("Ian Curtis", "ian@acme.com", "Sales", "Account Exec"),
                ("Jenny Forrest", "jenny@acme.com", "Sales", "Business Dev"),
                ("Kevin Malone", "kevin@acme.com", "Engineering", "QA Tester"),
                ("Laura Croft", "laura@acme.com", "Engineering", "Backend Lead"),
                ("Mike Ross", "mike@acme.com", "Legal", "Junior Associate"),
                ("Nina Simone", "nina@acme.com", "Product", "Analyst"),
                ("Oscar Isaac", "oscar@acme.com", "Sales", "Regional Manager")
            ]
            
            employee_ids = []
            for i, (name, email, dept, title) in enumerate(emp_data):
                manager_id = manager_ids[i // 3] # Distribute 3 per manager
                cur.execute("""
                    INSERT INTO employees (name, email, department, job_title, hire_date, manager_id, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
                """, (name, email, dept, title, "2021-06-01", manager_id, "active"))
                employee_ids.append(cur.fetchone()[0])
            print(f"✅ Created Employees")

            # Mock data: Reviews, Goals, Training
            print("📊 Generating mock metrics...")
            all_emp_ids = manager_ids + employee_ids
            # Performance Reviews
            for idx, emp in enumerate(all_emp_ids):
                rating = random.choice([2.5, 3.0, 3.5, 4.0, 4.5, 5.0])
                cur.execute("""
                    INSERT INTO performance_reviews (employee_id, period, year, rating, comments, status)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (emp, "Q1", 2024, rating, "Solid performance with room to grow.", "submitted"))
                
                # Make 1 or 2 low performers
                if idx in (5, 9):
                    cur.execute("""
                        INSERT INTO performance_reviews (employee_id, period, year, rating, comments, status)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (emp, "Q4", 2023, 2.0, "Needs immediate improvement in communication.", "acknowledged"))

            # Goals
            for emp in all_emp_ids:
                for _ in range(random.randint(1, 3)):
                    cur.execute("""
                        INSERT INTO goals (employee_id, title, description, status, progress, priority)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (emp, random.choice(["Improve API latency", "Learn React", "Close 5 deals", "Write tests"]), "Focus for Q2", random.choice(["in_progress", "not_started"]), random.randint(0, 80), random.choice(["high", "medium", "low"])))

            # Training
            for emp in all_emp_ids:
                for _ in range(random.randint(2, 4)):
                    cur.execute("""
                        INSERT INTO training_records (employee_id, course_name, provider, status, hours)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (emp, random.choice(["AWS Cert", "Security 101", "Leadership Skills", "Advanced React"]), "Udemy", random.choice(["completed", "enrolled"]), random.randint(10, 40)))

            conn.commit()
            print("\n🎉 Seeding completed successfully!")
            
    except Exception as e:
        conn.rollback()
        print(f"❌ Error seeding data: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    seed_data()
