import { LabBoardPage, labBoardMetadata } from "@/design-lab/lab-page";

export function generateMetadata() {
  return labBoardMetadata("sponsors");
}

export default function Page() {
  return <LabBoardPage board="sponsors" />;
}
