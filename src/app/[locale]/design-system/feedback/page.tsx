import { LabBoardPage, labBoardMetadata } from "@/design-lab/lab-page";

export function generateMetadata() {
  return labBoardMetadata("feedback");
}

export default function Page() {
  return <LabBoardPage board="feedback" />;
}
