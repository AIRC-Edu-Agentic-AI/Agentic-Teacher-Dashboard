import { useRef, useState } from 'react'
import {
  Alert, Box, Button, Chip, CircularProgress, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Toolbar, Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBackRounded'
import DeleteIcon from '@mui/icons-material/DeleteRounded'
import UploadIcon from '@mui/icons-material/UploadFileRounded'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { container } from '../../../di/container'
import { useContextStore } from '../../../shared/stores/contextStore'
import { AssessmentSection } from '../components/AssessmentSection'

export function ClassroomDetailView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  
  const { setModule, setPresentation } = useContextStore()

  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importSuccess, setImportSuccess] = useState('')
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const { data: classroom, isLoading } = useQuery({
    queryKey: ['classroom', id],
    queryFn: () => container.classroomService.getClassroom(id!),
    enabled: !!id,
  })

  const handleCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportError('')
    setImportSuccess('')
    try {
      const text = await file.text()
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length <= 1) {
        throw new Error('CSV file is empty or missing header')
      }

      // Read headers to map values
      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase())
      
      const studentsList: any[] = []
      
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''))
        if (row.length === 0 || !row[0]) continue

        const student: any = {}
        headers.forEach((header, idx) => {
          const val = row[idx]
          if (header === 'student_id' || header === 'num_of_prev_attempts' || header === 'studied_credits' || header === 'date_registration') {
            student[header] = parseInt(val)
          } else if (header === 'disability') {
            student[header] = val === 'Y' || val === 'true' || val === 'yes'
          } else {
            student[header] = val || ''
          }
        })

        if (!isNaN(student.student_id)) {
          studentsList.push(student)
        }
      }

      if (studentsList.length === 0) {
        throw new Error('No valid student records found in CSV')
      }

      await container.classroomService.importStudents(id!, studentsList)
      setImportSuccess(`Imported ${studentsList.length} students successfully`)
      await queryClient.invalidateQueries({ queryKey: ['classroom', id] })
      await queryClient.invalidateQueries({ queryKey: ['oulad-index'] })
    } catch (e: any) {
      setImportError(e.message)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this classroom?')) return
    try {
      await container.classroomService.deleteClassroom(id!)
      await queryClient.invalidateQueries({ queryKey: ['classrooms'] })
      await queryClient.invalidateQueries({ queryKey: ['oulad-index'] })
      queryClient.removeQueries({ queryKey: ['classroom', id] })
      navigate('/classroom')
    } catch (e: any) {
      setImportError(e.message)
    }
  }

  const startEdit = () => {
    if (!classroom) return
    setEditName(classroom.name)
    setEditDescription(classroom.description ?? '')
    setEditError('')
    setEditing(true)
  }

  const handleSave = async () => {
    if (!editName.trim()) { setEditError('Classroom name is required'); return }
    setSaving(true)
    setEditError('')
    try {
      await container.classroomService.updateClassroom(id!, { name: editName, description: editDescription })
      await queryClient.invalidateQueries({ queryKey: ['classroom', id] })
      await queryClient.invalidateQueries({ queryKey: ['classrooms'] })
      setEditing(false)
    } catch (e: any) {
      setEditError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return (
    <Box sx={{ display: 'flex', p: 4, gap: 1.5, alignItems: 'center' }}>
      <CircularProgress size={18} sx={{ color: '#1D9E75' }} />
      <Typography sx={{ fontSize: 13, color: '#6B7280', fontFamily: '"IBM Plex Mono", monospace' }}>Loading...</Typography>
    </Box>
  )

  if (!classroom) return (
    <Box sx={{ p: 4 }}>
      <Typography sx={{ color: '#E24B4A' }}>Classroom not found.</Typography>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Toolbar sx={{ bgcolor: '#fff', borderBottom: '1px solid #E5E3DC', gap: 2, minHeight: '60px !important', px: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/classroom')} size="small" sx={{ color: '#6B7280', fontSize: 12 }}>
          Classrooms
        </Button>
        <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#0A1628', flex: 1, fontFamily: '"IBM Plex Sans", sans-serif' }}>
          {classroom.name}
        </Typography>
        <Chip label={`${classroom.module} · ${classroom.code_presentation}`} size="small"
          sx={{ bgcolor: '#1D9E7522', color: '#5DCAA5', fontSize: 11, fontFamily: '"IBM Plex Mono", monospace' }} />
        <Button variant="outlined" size="small" onClick={startEdit} sx={{ fontSize: 12, borderColor: '#E5E3DC', color: '#6B7280' }}>Edit</Button>
        <Button variant="outlined" size="small" startIcon={<UploadIcon />} onClick={() => fileRef.current?.click()} disabled={importing}
          sx={{ fontSize: 12, borderColor: '#E5E3DC', color: '#6B7280' }}>
          {importing ? 'Importing...' : 'Import CSV'}
        </Button>
        <Button variant="outlined" size="small" startIcon={<DeleteIcon />} onClick={handleDelete}
          sx={{ fontSize: 12, borderColor: '#E24B4A', color: '#E24B4A' }}>Delete</Button>
        <input ref={fileRef} type="file" accept=".csv" hidden onChange={handleCSV} />
      </Toolbar>

      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {importError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{importError}</Alert>}
        {importSuccess && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>{importSuccess}</Alert>}

        {editing && (
          <Box sx={{ border: '1px solid #E5E3DC', borderRadius: 2, p: 2, mb: 2, bgcolor: '#fff' }}>
            {editError && <Alert severity="error" sx={{ mb: 2 }}>{editError}</Alert>}
            <TextField fullWidth label="Classroom name" size="small" value={editName}
              onChange={e => setEditName(e.target.value)} sx={{ mb: 2 }} />
            <TextField fullWidth label="Description" size="small" multiline rows={3}
              value={editDescription} onChange={e => setEditDescription(e.target.value)} sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="contained" size="small" disabled={saving} onClick={handleSave}
                sx={{ bgcolor: '#0F6E56', '&:hover': { bgcolor: '#085041' }, fontSize: 12 }}>
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
              <Button variant="text" size="small" disabled={saving} onClick={() => setEditing(false)}
                sx={{ fontSize: 12, color: '#6B7280' }}>Cancel</Button>
            </Box>
          </Box>
        )}

        <Typography sx={{ fontSize: 13, fontWeight: 500, color: '#0A1628', mb: 1.5 }}>
          Students — {classroom.student_ids?.length ?? 0} total
        </Typography>

        {classroom.student_ids?.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: '#9CA3AF' }}>No students yet. Import a CSV to add students.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: '#6B7280', bgcolor: '#F8F7F4' }}>Student ID</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {classroom.student_ids?.map(sid => (
                <TableRow key={sid} hover sx={{ cursor: 'pointer' }} onClick={() => {
                  setModule(classroom.module)
                  setPresentation(classroom.code_presentation)
                  navigate(`/student/${sid}`)
                }}>
                  <TableCell sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 12 }}>#{sid}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {id && <AssessmentSection classroomId={id} />}
      </Box>
    </Box>
  )
}