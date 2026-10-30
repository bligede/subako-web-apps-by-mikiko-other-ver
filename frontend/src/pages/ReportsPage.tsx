import { Badge, DataModeBanner, PageHeader } from '../components/ui';
import { useAuth } from '../features/auth/AuthContext';

const PLANNED = [
  {
    name: 'Distribusi harian',
    detail: 'Volume MEASURED/ESTIMATED per pintu dan tempek, dengan deviasi terhadap rule.',
    phase: 'Phase 5',
  },
  {
    name: 'Kinerja pintu',
    detail: 'Jam operasi, jumlah command, penolakan, dan ketersediaan perangkat.',
    phase: 'Phase 5',
  },
  {
    name: 'Penyimpangan aturan',
    detail: 'Slot di luar toleransi beserta penyebab yang tercatat pada alert/command.',
    phase: 'Phase 4–5',
  },
  {
    name: 'Aktivitas operator',
    detail: 'Rekap command dan acknowledgement per pengguna dari audit trail.',
    phase: 'Phase 5',
  },
];

export default function ReportsPage() {
  const { can } = useAuth();
  return (
    <>
      <PageHeader
        title="Laporan"
        lede="Laporan terjadwal belum diimplementasikan pada Phase 1. Halaman ini menjelaskan cakupan yang disepakati agar tidak ada angka contoh yang disalahartikan sebagai hasil."
        badges={<Badge tone="info">PHASE 5</Badge>}
      />
      <DataModeBanner />

      <div className="grid g-2 mt-4">
        {PLANNED.map((report) => (
          <section className="card" key={report.name}>
            <div className="card__head">
              <h2>{report.name}</h2>
              <span className="spacer" />
              <Badge tone="neutral">{report.phase}</Badge>
            </div>
            <div className="card__body">
              <p className="small muted">{report.detail}</p>
            </div>
            <div className="card__foot">
              <span>Belum tersedia</span>
            </div>
          </section>
        ))}
      </div>

      <div className="banner banner--info mt-4">
        <span>ℹ️</span>
        <div className="small">
          Ekspor PDF/Excel memerlukan penentuan format dan tanda tangan laporan (K-06). Sampai itu
          diputuskan, data dapat diperiksa langsung di Monitoring, Buku Catatan Air, dan audit
          administrasi.
          {can('report.export') ? ' Role Anda akan memiliki akses ekspor setelah fitur tersedia.' : ''}
        </div>
      </div>
    </>
  );
}
