import DearoApp from "../ui/DearoApp";
import { AppErrorBoundary } from "../ui/AppErrorBoundary";
export default function Index() {
  return (
    <AppErrorBoundary>
      <DearoApp />
    </AppErrorBoundary>
  );
}
