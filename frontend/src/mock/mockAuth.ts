export const mockAdminUser = {
  id: "1",
  username: "admin",
  name: "Admin",
  initials: "AD",
  email: "admin@company.dz",
  role: "IT_ADMIN" as const,
  department: null,
}

export const mockUsers = [
  { id: "1", username: "ahmed.benali", name: "Ahmed Benali", initials: "AB", email: "ahmed.benali@company.dz", role: "EMPLOYEE", department: "engineering", is_active: true, last_login: "2025-03-15 10:32", failed_logins: 0 },
  { id: "2", username: "fatima.khaldi", name: "Fatima Khaldi", initials: "FK", email: "fatima.khaldi@company.dz", role: "EMPLOYEE", department: "engineering", is_active: true, last_login: "2025-03-15 09:14", failed_logins: 0 },
  { id: "3", username: "manager1", name: "Manager One", initials: "M1", email: "manager1@company.dz", role: "MANAGER", department: "engineering", is_active: false, last_login: "2025-03-10 14:20", failed_logins: 6 },
]

export const mockEvents = [
  { id: 1, event_type: "LOGIN_FAILURE", severity: "MEDIUM", service: "auth", user_id: "1", source_ip: "10.8.0.10", payload: { attempt: 3 }, created_at: "2025-03-15 10:31:00" },
  { id: 2, event_type: "LOGIN_FAILURE", severity: "MEDIUM", service: "auth", user_id: "1", source_ip: "10.8.0.10", payload: { attempt: 4 }, created_at: "2025-03-15 10:31:15" },
  { id: 3, event_type: "ACCOUNT_LOCKED", severity: "HIGH", service: "auth", user_id: "1", source_ip: "10.8.0.10", payload: { total_attempts: 5 }, created_at: "2025-03-15 10:31:30" },
  { id: 4, event_type: "FILE_DOWNLOAD", severity: "INFO", service: "files", user_id: "2", source_ip: "10.8.0.12", payload: { filename: "report.pdf" }, created_at: "2025-03-15 09:20:00" },
  { id: 5, event_type: "EMAIL_SENT", severity: "INFO", service: "mail", user_id: "2", source_ip: "10.8.0.12", payload: { recipient: "manager1@company.dz" }, created_at: "2025-03-15 09:25:00" },
  { id: 6, event_type: "LOGIN_SUCCESS", severity: "INFO", service: "auth", user_id: "2", source_ip: "10.8.0.12", payload: {}, created_at: "2025-03-15 09:14:00" },
]

export const mockAlerts = [
  { id: "a1", alert_type: "BRUTE_FORCE", severity: "CRITICAL", user_id: "1", username: "ahmed.benali", initials: "AB", description: "5 failed login attempts detected within 2 minutes from IP 10.8.0.10", evidence: [1, 2, 3], status: "OPEN", created_at: "2025-03-15 10:31:30" },
  { id: "a2", alert_type: "MASS_DOWNLOAD", severity: "CRITICAL", user_id: "2", username: "fatima.khaldi", initials: "FK", description: "18 file downloads detected within 10 minutes", evidence: [4], status: "INVESTIGATING", created_at: "2025-03-15 09:20:00" },
  { id: "a3", alert_type: "IMPOSSIBLE_TRAVEL", severity: "HIGH", user_id: "3", username: "manager1", initials: "M1", description: "Login from Algiers followed by login from Paris 20 minutes later", evidence: [6], status: "OPEN", created_at: "2025-03-14 22:10:00" },
  { id: "a4", alert_type: "OFF_HOURS_FILE_ACCESS", severity: "MEDIUM", user_id: "1", username: "ahmed.benali", initials: "AB", description: "File downloaded at 03:14 from unknown IP 192.168.1.55", evidence: [4], status: "CLOSED", created_at: "2025-03-14 03:14:00" },
]

export const mockBaselines = {
  "1": { user_id: "1", username: "ahmed.benali", avg_login_hour: 9.2, known_ips: ["10.8.0.10", "10.8.0.14"], avg_messages_day: 24, avg_files_day: 8, avg_emails_day: 11, confidence: 0.73, tx_count: 47 },
  "2": { user_id: "2", username: "fatima.khaldi", avg_login_hour: 8.5, known_ips: ["10.8.0.12"], avg_messages_day: 31, avg_files_day: 12, avg_emails_day: 9, confidence: 0.21, tx_count: 8 },
  "3": { user_id: "3", username: "manager1", avg_login_hour: 10.1, known_ips: ["10.8.0.15", "10.8.0.20", "10.8.0.22"], avg_messages_day: 15, avg_files_day: 5, avg_emails_day: 20, confidence: 0.91, tx_count: 124 },
}
