import sys
sys.path.insert(0, 'backend')
from app.core.security import hash_password
import sqlite3
from datetime import datetime, timedelta

def main():
    conn = sqlite3.connect('backend/dgym.db')
    c = conn.cursor()

    # 1. Give member@thedgym.com an active membership
    c.execute('SELECT id FROM members WHERE email = ?', ('member@thedgym.com',))
    row = c.fetchone()
    if not row:
        c.execute('''
            INSERT INTO members (member_code, first_name, last_name, email, status, is_active, joined_at, created_at, updated_at)
            VALUES ('MEM-ALEX', 'Alex', 'Cruz', 'member@thedgym.com', 'active', 1, datetime('now'), datetime('now'), datetime('now'))
        ''')
        member_id = c.lastrowid
    else:
        member_id = row[0]
        c.execute('UPDATE members SET status = "active", is_active = 1 WHERE id = ?', (member_id,))

    # Ensure member_memberships record
    c.execute('SELECT id FROM member_memberships WHERE member_id = ? AND status = "active"', (member_id,))
    m_row = c.fetchone()
    if not m_row:
        end_date = (datetime.now() + timedelta(days=60)).strftime('%Y-%m-%d %H:%M:%S')
        start_date = (datetime.now() - timedelta(days=5)).strftime('%Y-%m-%d %H:%M:%S')
        c.execute('''
            INSERT INTO member_memberships (member_id, plan_id, start_date, end_date, status, paid_amount, payment_method, created_at, updated_at)
            VALUES (?, 2, ?, ?, 'active', 1500.0, 'cash', datetime('now'), datetime('now'))
        ''', (member_id, start_date, end_date))
        print('Inserted active membership for Alex Cruz')
    else:
        print('Alex Cruz already has active membership')

    # 2. Setup user@thedgym.com as Registered User (No Plan)
    user_hash = hash_password('user12345')
    c.execute('SELECT id FROM users WHERE email = ?', ('user@thedgym.com',))
    u_row = c.fetchone()
    if not u_row:
        c.execute('''
            INSERT INTO users (email, hashed_password, full_name, phone, role, is_active, created_at, updated_at)
            VALUES ('user@thedgym.com', ?, 'Jordan Ramos', '09171234567', 'member', 1, datetime('now'), datetime('now'))
        ''', (user_hash,))
        user_id = c.lastrowid
        print('Created user@thedgym.com')
    else:
        c.execute('UPDATE users SET hashed_password = ?, full_name = "Jordan Ramos", role = "member" WHERE email = ?', (user_hash, 'user@thedgym.com'))
        print('Updated user@thedgym.com')

    # Ensure Jordan Ramos has an inactive member record and NO active memberships
    c.execute('SELECT id FROM members WHERE email = ?', ('user@thedgym.com',))
    jm_row = c.fetchone()
    if not jm_row:
        c.execute('''
            INSERT INTO members (member_code, first_name, last_name, email, status, is_active, joined_at, created_at, updated_at)
            VALUES ('MEM-JORDAN', 'Jordan', 'Ramos', 'user@thedgym.com', 'inactive', 1, datetime('now'), datetime('now'), datetime('now'))
        ''', )
        print('Created inactive member record for Jordan Ramos')
    else:
        c.execute('UPDATE members SET status = "inactive" WHERE id = ?', (jm_row[0],))
        c.execute('DELETE FROM member_memberships WHERE member_id = ?', (jm_row[0],))
        print('Cleaned memberships for Jordan Ramos')

    conn.commit()
    conn.close()
    print('DEMO SEED COMPLETED SUCCESSFULLY')

if __name__ == '__main__':
    main()
