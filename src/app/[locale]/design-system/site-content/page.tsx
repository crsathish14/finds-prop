import { LabBoardPage, labBoardMetadata } from "@/design-lab/lab-page";

export function generateMetadata() {
  return labBoardMetadata("site-content");
}

export default function Page() {
  return <LabBoardPage board="site-content" />;
}
