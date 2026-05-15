import { useState, useMemo } from 'react';
import { 
  Box, Typography, Paper, List, ListItemText, Divider, 
  Skeleton, Dialog, DialogTitle, DialogContent, IconButton, ListItemButton 
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useQuery } from '@tanstack/react-query';
import { useContextStore } from '../../../shared/stores/contextStore';
import { container } from '../../../di/container';
import { AssessmentRecord } from '../../../types/domain';

// Local interface to extend without touching domain.ts
interface AssignmentUI extends AssessmentRecord {
  weekDue: number;
  averageScore: number;
  distribution: number[]; // [0-20, 21-40, 41-60, 61-80, 81-100]
}

export function CourseInfoSections() {
  const { selectedModule, selectedPresentation, currentWeek } = useContextStore();
  const [selectedAsgn, setSelectedAsgn] = useState<AssignmentUI | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['course-info', selectedModule, selectedPresentation],
    queryFn: () => container.dataService.getCourse(selectedModule, selectedPresentation),
    enabled: !!selectedModule && !!selectedPresentation
  });

  const assignments = useMemo(() => {
    if (!data || !data.students) return [];

    return data.students[0].assessments.map((baseAsgn): AssignmentUI => {
      let totalScore = 0, count = 0;
      const dist = [0, 0, 0, 0, 0];

      data.students.forEach(student => {
        const sa = student.assessments.find(a => a.id_assessment === baseAsgn.id_assessment);
        if (sa && typeof sa.score === 'number') {
          totalScore += sa.score; count++;
          if (sa.score <= 20) dist[0]++;
          else if (sa.score <= 40) dist[1]++;
          else if (sa.score <= 60) dist[2]++;
          else if (sa.score <= 80) dist[3]++;
          else dist[4]++;
        }
      });

      const isExam = baseAsgn.assessment_type === 'Exam';
      return {
        ...baseAsgn,
        weekDue: baseAsgn.date_due ? Math.ceil(baseAsgn.date_due / 7) : (isExam ? 39 : 0),
        averageScore: count > 0 ? Math.round(totalScore / count) : 0,
        distribution: dist
      };
    }).sort((a, b) => a.weekDue - b.weekDue);
  }, [data]);

  if (isLoading) return <Skeleton variant="rectangular" height={200} />;

  return (
    <Box sx={{ mt: 2 }}>
      <Paper sx={{ p: 2, border: '1px solid #E5E3DC', borderRadius: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 12, color: '#1D9E75', mb: 2, textTransform: 'uppercase' }}>
          Assignments Overview
        </Typography>
        <List dense>
          {assignments.map((item) => {
            const isPast = item.weekDue < currentWeek;
            return (
              <ListItemButton 
                key={item.id_assessment} 
                onClick={() => setSelectedAsgn(item)}
                sx={{ mb: 1, borderRadius: 1, border: '1px solid #F3F4F6', opacity: isPast ? 0.6 : 1 }}
              >
                <ListItemText 
                  primary={item.assessment_type} 
                  secondary={`Week ${item.weekDue} | Weight: ${item.weight}%`}
                  primaryTypographyProps={{ fontWeight: 600, sx: { textDecoration: isPast ? 'line-through' : 'none' }}}
                />
                <Typography sx={{ fontWeight: 800, color: '#1D9E75' }}>{item.averageScore}%</Typography>
              </ListItemButton>
            );
          })}
        </List>
      </Paper>

      <Dialog open={!!selectedAsgn} onClose={() => setSelectedAsgn(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>
          {selectedAsgn?.assessment_type} Details
          <IconButton onClick={() => setSelectedAsgn(null)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {/* Header Info: Score & Weight */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, p: 2, bgcolor: '#F8FAFC', borderRadius: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>AVG SCORE</Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#1D9E75' }}>{selectedAsgn?.averageScore}%</Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>WEIGHT</Typography>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{selectedAsgn?.weight}%</Typography>
            </Box>
          </Box>

          {/* CUSTOM BAR CHART Section */}
          <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 3 }}>Grade Distribution</Typography>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 180, mb: 4, px: 1 }}>
            {selectedAsgn?.distribution.map((val, idx) => {
              const maxVal = Math.max(...selectedAsgn.distribution);
              const heightPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
              const labels = ['0-20', '21-40', '41-60', '61-80', '81-100'];
              
              return (
                <Box key={idx} sx={{ 
                  width: '18%', 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  justifyContent: 'flex-end'
                }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 700, mb: 1 }}>{val}</Typography>
                  
                  
                  <Box sx={{ 
                    width: '100%', 
                    flexGrow: 1, 
                    display: 'flex', 
                    alignItems: 'flex-end'
                  }}>
                    <Box sx={{ 
                      width: '100%', 
                      height: `${heightPct}%`,
                      minHeight: val > 0 ? '4px' : '0px',
                      bgcolor: idx < 2 ? '#FDA4AF' : (idx === 2 ? '#FDE047' : '#6EE7B7'),
                      borderRadius: '6px 6px 0 0',
                      transition: 'height 0.4s ease-out'
                    }} />
                  </Box>

                  <Typography sx={{ fontSize: 9, mt: 1.5, color: 'text.secondary', fontWeight: 600 }}>{labels[idx]}</Typography>
                </Box>
              );
            })}
          </Box>
          <Divider sx={{ my: 2 }} />

          {/* Information & Resources */}
          <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 1 }}>Assignment Info</Typography>
          <Typography sx={{ fontSize: 13, color: '#4B5563', mb: 2 }}>
            This {selectedAsgn?.assessment_type} (ID: {selectedAsgn?.id_assessment}) is due on Day {selectedAsgn?.date_due}.
            It contributes significantly to the student's continuous assessment grade.
          </Typography>

          <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 1 }}>Linked Resources</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography sx={{ fontSize: 13, color: '#2563EB', cursor: 'pointer' }}>📎 Preparation_Guide.pdf</Typography>
            <Typography sx={{ fontSize: 13, color: '#2563EB', cursor: 'pointer' }}>📎 Scoring_Rubric.docx</Typography>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}