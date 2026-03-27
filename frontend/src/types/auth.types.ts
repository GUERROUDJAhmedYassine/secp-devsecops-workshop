export interface User {
  id: string;
  username: string;
  full_name: string;
  role: 'EMPLOYEE' | 'MANAGER' | 'IT_ADMIN';
  department: string;
  vpn_status: 'Active' | 'Inactive';
}
