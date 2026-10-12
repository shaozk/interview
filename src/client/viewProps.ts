import type { Interview, InterviewStatus } from "../shared/types";

export interface ViewProps {
  interviews: Interview[];
  onEdit: (interview: Interview) => void;
  onDelete: (interview: Interview) => void;
  onStatusChange: (interview: Interview, status: InterviewStatus) => void;
}
