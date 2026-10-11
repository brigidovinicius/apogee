export type CommunityPhoto = {
  id: string;
  src: string;
  author: string;
  instagram: string;
  anonymous: boolean;
  width: number;
  height: number;
  createdAt: string;
};

export type CommunityPhotoPage = {
  photos: CommunityPhoto[];
  nextOffset: number | null;
};
