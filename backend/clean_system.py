"""
Clean up test data and standardize names in dgym.db:
- Removes duplicate timestamped test plans (keeps canonical plans)
- Fixes class session names (removes timestamps, fixes encoding dashes)
- Fixes member names (removes test timestamps from names)
"""
import sqlite3

def clean_database():
    conn = sqlite3.connect("dgym.db")
    cursor = conn.cursor()

    # 1. Clean class sessions
    # Fix encoding and timestamps
    cursor.execute("""
        UPDATE class_sessions 
        SET name = 'Barbell Club - Morning' 
        WHERE id = 1
    """)
    cursor.execute("""
        UPDATE class_sessions 
        SET name = 'Open Gym - Strength Day' 
        WHERE id = 3
    """)
    cursor.execute("""
        UPDATE class_sessions 
        SET name = 'Deadlift Clinic' 
        WHERE name LIKE 'Deadlift Clinic%' AND id = 5
    """)
    # Delete duplicate test classes with id > 5
    cursor.execute("DELETE FROM class_enrollments WHERE class_session_id > 5")
    cursor.execute("DELETE FROM class_sessions WHERE id > 5")

    # 2. Clean duplicate test membership plans (keep IDs 1 to 6)
    cursor.execute("DELETE FROM member_memberships WHERE plan_id > 6")
    cursor.execute("DELETE FROM membership_plans WHERE id > 6")

    # 3. Clean test member names
    cursor.execute("""
        UPDATE members 
        SET last_name = 'Mendoza' 
        WHERE last_name LIKE 'Mendoza_%'
    """)

    conn.commit()
    print("Database cleaned successfully.")

    # Show final state
    cursor.execute("SELECT id, name, class_type, status FROM class_sessions")
    print("Classes after cleanup:", cursor.fetchall())

    cursor.execute("SELECT id, name, price_php FROM membership_plans")
    print("Plans after cleanup:", cursor.fetchall())

    conn.close()

if __name__ == "__main__":
    clean_database()
