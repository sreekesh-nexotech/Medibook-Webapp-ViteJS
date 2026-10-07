import { useDoctorPhotoQuery } from '@/features/doctors/application/queries/useDoctorPhotoQuery';
import { Avatar } from '@/shared/ui/Avatar';

interface DoctorAvatarProps {
  name: string;
  photoFileId: string | null;
  size?: number;
}

/** A doctor's stored photo (signed link from the files API), else their initials. */
export function DoctorAvatar({ name, photoFileId, size }: DoctorAvatarProps) {
  const photo = useDoctorPhotoQuery(photoFileId);
  return <Avatar name={name} src={photo.data} size={size} />;
}
