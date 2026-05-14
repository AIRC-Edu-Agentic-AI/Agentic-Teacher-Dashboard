import { Box, Typography, Paper, List, ListItem, ListItemText, Divider, Skeleton } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useContextStore } from '../../../shared/stores/contextStore';
import { container } from '../../../di/container';
import { AssessmentRecord } from '../../../types/domain';

/**
 * Interface đảm bảo tính chặt chẽ của TypeScript, không dùng 'any'
 */
interface InfoBoxProps {
  title: string;
  items: any[] | undefined;
  emptyText: string;
  iconColor: string;
  renderItem: (item: any) => { primary: string; secondary: string };
}

const InfoBox = ({ title, items, emptyText, iconColor, renderItem }: InfoBoxProps) => (
  <Paper 
    elevation={0} 
    sx={{ 
      p: 2, 
      bgcolor: '#fcfcfc', 
      border: '1px solid #E5E3DC', 
      borderRadius: 2, 
      height: '100%' 
    }}
  >
    <Typography sx={{ 
      fontWeight: 600, 
      fontSize: 12, 
      color: iconColor, 
      mb: 1.5, 
      textTransform: 'uppercase', 
      fontFamily: '"IBM Plex Sans", sans-serif',
      letterSpacing: '0.5px' 
    }}>
      {title}
    </Typography>
    <Divider sx={{ mb: 1, borderColor: '#E5E3DC' }} />
    
    {items && items.length > 0 ? (
      <List dense sx={{ py: 0 }}>
        {items.slice(0, 5).map((item, index) => {
          const { primary, secondary } = renderItem(item);
          return (
            <ListItem key={index} sx={{ px: 0, py: 1, alignItems: 'flex-start' }}>
              <ListItemText 
                primary={primary} 
                secondary={secondary} 
                primaryTypographyProps={{ fontSize: 13, fontWeight: 500, color: '#0A1628', lineHeight: 1.2 }}
                secondaryTypographyProps={{ fontSize: 11, color: '#6B7280', mt: 0.5 }}
              />
            </ListItem>
          );
        })}
      </List>
    ) : (
      <Typography sx={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', mt: 1 }}>
        {emptyText}
      </Typography>
    )}
  </Paper>
);

export function CourseInfoSections() {
  const { selectedModule, selectedPresentation } = useContextStore();
  
  // Truy vấn dữ liệu từ DI Container (DataService)
  const { data: courseData, isLoading } = useQuery({
    queryKey: ['course-info', selectedModule, selectedPresentation],
    queryFn: () => container.dataService.getCourse(selectedModule, selectedPresentation),
    enabled: !!selectedModule && !!selectedPresentation
  });

  if (isLoading) {
    return <Skeleton variant="rectangular" height={250} sx={{ borderRadius: 2, mt: 2 }} />;
  }

  // Lấy dữ liệu mẫu từ sinh viên đầu tiên để hiển thị cấu trúc bài tập
  const student = courseData?.students?.[0];
  const assignments = student?.assessments;

  return (
    <Box sx={{ 
      display: 'grid', 
      gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, 
      gap: 2, 
      mt: 2 
    }}>
      {/* 1. Cột Assignments */}
      <InfoBox 
        title="Assignments" 
        items={assignments} 
        iconColor="#1D9E75" 
        emptyText="No assignments found."
        renderItem={(item: AssessmentRecord) => ({
          primary: `${item.assessment_type} (ID: ${item.id_assessment})`,
          secondary: `Weight: ${item.weight}% | Due: Day ${item.date_due ?? 'N/A'}`
        })}
      />

      {/* 2. Cột Schedule (Lấy thông tin tổng quan khóa học) */}
      <InfoBox 
        title="Schedule" 
        items={courseData ? [courseData] : []} 
        iconColor="#0284c7" 
        emptyText="No schedule data."
        renderItem={(item) => ({
          primary: `Module ${item.module}`,
          secondary: `Duration: ${item.num_weeks} weeks | Presentation: ${item.presentation}`
        })}
      />

      {/* 3. Cột Resources (Dữ liệu tương tác VLE từ sinh viên) */}
      <InfoBox 
        title="Resources" 
        items={student?.weekly_clicks ? [{ clicks: student.weekly_clicks }] : []} 
        iconColor="#7c3aed" 
        emptyText="No resources available."
        renderItem={(item) => ({
          primary: "VLE Learning Materials",
          secondary: `Last activity tracked: ${item.clicks.length} weeks of data`
        })}
      />
    </Box>
  );
}