import { useState, useMemo } from 'react';
import { 
  Box, Typography, List, ListItemText, Divider, 
  Skeleton, Dialog, DialogTitle, DialogContent, IconButton, ListItemButton 
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useQuery } from '@tanstack/react-query';
import { useContextStore } from '../../../shared/stores/contextStore';
import { container } from '../../../di/container';
import { AssessmentRecord } from '../../../types/domain';

interface AssignmentUI extends AssessmentRecord {
  weekDue: number;
  averageScore: number;
  distribution: number[];
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

  if (isLoading) return <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />;

  return (
    <Box className="dashboard-section-card">
      <Typography sx={{ fontWeight: 700, fontSize: 12, color: '#1D9E75', mb: 2, textTransform: 'uppercase' }}>
        Assignments Overview
      </Typography>
      <List dense>
        {assignments.map((item) => {
          // Assignment is in the future if its due week is greater than the current simulation week
          const isFuture = item.weekDue > currentWeek;

          return (
            <ListItemButton 
              key={item.id_assessment} 
              onClick={() => setSelectedAsgn(item)}
              sx={{ 
                mb: 1, 
                borderRadius: 2, 
                border: '1px solid #F1F5F9', 
                /* Dim future items to visually separate them from current progress */
                opacity: isFuture ? 0.5 : 1 
              }}
            >
              <ListItemText 
                primary={item.assessment_type} 
                secondary={`Week ${item.weekDue} | Weight: ${item.weight}%`}
                /* Kept clean without line-through for better readability */
                primaryTypographyProps={{ fontWeight: 600 }}
              />
              <Typography sx={{ fontWeight: 800, color: isFuture ? '#94A3B8' : '#1D9E75' }}>
                {/* Logic: Hide score with a dash if the assignment hasn't happened yet */}
                {isFuture ? '—' : `${item.averageScore}%`}
              </Typography>
            </ListItemButton>
          );
        })}
      </List>

      <Dialog open={!!selectedAsgn} onClose={() => setSelectedAsgn(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>
          {selectedAsgn?.assessment_type} Details
          <IconButton onClick={() => setSelectedAsgn(null)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, p: 2, bgcolor: '#F8FAFC', borderRadius: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>AVG SCORE</Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#1D9E75' }}>
                {/* In details popup, check if we should reveal the score */}
                {selectedAsgn && selectedAsgn.weekDue > currentWeek ? 'TBD' : `${selectedAsgn?.averageScore}%`}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>WEIGHT</Typography>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{selectedAsgn?.weight}%</Typography>
            </Box>
          </Box>
          {/* ... Rest of the Dialog Content (Chart, Info) remains similar ... */}
        </DialogContent>
      </Dialog>
    </Box>
  );
}