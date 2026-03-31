import request from './request'
import type { PaginatedResponse } from '@/types'

// 考勤状态
export type AttendanceStatus = 'normal' | 'late' | 'leave' | 'absent' | 'early'

// 考勤记录参数
export interface AttendanceListParams {
  page?: number
  pageSize?: number
  employee_id?: number
  employee_name?: string
  start_date?: string
  end_date?: string
  status?: AttendanceStatus | ''
}

// 打卡参数
export interface AttendanceCheckInParams {
  employee_id: number
  type: 'clock_in' | 'clock_out'
  location?: string
}

// 考勤记录
export interface AttendanceRecord {
  id: number
  employee_id: number
  employee_name: string
  date: string
  clock_in?: string
  clock_out?: string
  status: AttendanceStatus
  work_hours?: number
  remark?: string
  created_at?: string
}

// 考勤统计
export interface AttendanceStat {
  employee_id: number
  employee_name: string
  department: string
  month: string
  normal_days: number
  late_days: number
  absent_days: number
  leave_days: number
  early_days: number
  total_work_hours: number
  attendance_rate: number
}

// 考勤 API
export const attendanceApi = {
  // 获取考勤记录
  getList(params: AttendanceListParams): Promise<PaginatedResponse<AttendanceRecord>> {
    return request.get('/attendance', { params })
  },

  // 打卡
  checkIn(data: AttendanceCheckInParams): Promise<AttendanceRecord> {
    return request.post('/attendance', data)
  },

  // 获取考勤统计
  getStats(params: {
    month?: string
    employee_id?: number
    department?: string
  }): Promise<AttendanceStat[]> {
    return request.get('/attendance/stats', { params })
  },

  // 获取员工考勤记录
  getEmployeeRecords(employeeId: number, month?: string): Promise<AttendanceRecord[]> {
    return request.get(`/attendance/employee/${employeeId}`, { params: { month } })
  }
}
