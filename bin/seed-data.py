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

            # ADD TEAMS COLUMN IF NOT EXISTS
            cur.execute("""
                ALTER TABLE employees ADD COLUMN IF NOT EXISTS team VARCHAR(255);
            """)
            
            # Admin
            admin_pass = bcrypt.hashpw(b"Admin@1234", bcrypt.gensalt()).decode()
            cur.execute("""
                INSERT INTO users (name, email, password_hash, role)
                VALUES (%s, %s, %s, %s) RETURNING id
            """, ("ACME Admin", "admin@acme.com", admin_pass, "admin"))
            print("✅ Created Admin")

            # 2 HRs
            hr_pass = bcrypt.hashpw(b"HR@1234", bcrypt.gensalt()).decode()
            hrs = [
                ("Sarah Jenkins", "hr1@acme.com"),
                ("Toby Flenderson", "hr2@acme.com")
            ]
            for name, email in hrs:
                cur.execute("""
                    INSERT INTO users (name, email, password_hash, role, department)
                    VALUES (%s, %s, %s, %s, %s) RETURNING id
                """, (name, email, hr_pass, "hr", "Human Resources"))
                cur.execute("""
                    INSERT INTO employees (name, email, department, job_title, hire_date, status)
                    VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
                """, (name, email, "Human Resources", "HR Rep", "2018-05-10", "active"))
            print("✅ Created HR Profiles")

            # 4 Managers
            managers = [
                ("Michael Scott", "manager1@acme.com", "Engineering", "Engineering Manager"),
                ("Leslie Knope", "manager2@acme.com", "Product", "Product Lead"),
                ("Ron Swanson", "manager3@acme.com", "Operations", "Ops Director"),
                ("Harvey Specter", "manager4@acme.com", "Legal", "Chief Counsel")
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

            # Employees (under each manager having 2 teams, and 10 employees per team -> 80 total)
            print("⏳ Creating 80 Employees...")
            employee_ids = []

            for m_idx, manager_id in enumerate(manager_ids):
                manager_dept = managers[m_idx][2]
                for team_num in range(1, 3):
                    team_name = f"Team {team_num} - {manager_dept}"
                    for e_num in range(1, 11):
                        emp_name = f"Emp_{m_idx+1}_{team_num}_{e_num}"
                        emp_email = f"emp{m_idx+1}_{team_num}_{e_num}@acme.com"
                        cur.execute("""
                            INSERT INTO employees (name, email, department, job_title, hire_date, manager_id, status, team)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
                        """, (emp_name, emp_email, manager_dept, "Staff", "2021-06-01", manager_id, "active", team_name))
                        employee_ids.append(cur.fetchone()[0])
            print(f"✅ Created {len(employee_ids)} Employees")

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
