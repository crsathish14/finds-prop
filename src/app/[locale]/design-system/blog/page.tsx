import { LabBoardPage, labBoardMetadata } from "@/design-lab/lab-page";

export function generateMetadata() {
  return labBoardMetadata("blog");
}

export default function Page() {
  return <LabBoardPage board="blog" />;
}
