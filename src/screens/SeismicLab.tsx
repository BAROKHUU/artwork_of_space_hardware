import { SeismicMission } from '../missions/SeismicMission';

const NO_OP = () => undefined;

export default function SeismicLab() {
  return <SeismicMission id="lab_seismic" lab config={{ captures: 0 }} onResult={NO_OP} />;
}
