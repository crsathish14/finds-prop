import { LabBoardPage, labBoardMetadata } from "@/design-lab/lab-page";

export function generateMetadata() {
  return labBoardMetadata("projects");
}

export default function Page() {
  return <LabBoardPage board="projects" />;
}
