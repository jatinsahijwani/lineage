import Link from "next/link";

export default function Home() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-5xl font-bold text-brand-900 mb-4">Lineage Protocol</h1>
      <p className="text-xl text-gray-600 mb-2">Provenance &amp; royalty layer for AI agents on 0G</p>
      <p className="text-gray-500 mb-10 max-w-2xl mx-auto">
        Every dataset, model, and skill is an iNFT. Every inference produces a signed attribution receipt on 0G DA.
        Royalties stream automatically to every contributor in the lineage.
      </p>
      <div className="flex gap-4 justify-center flex-wrap">
        <Link href="/mint"
          className="px-6 py-3 bg-brand-500 text-white rounded-lg font-semibold hover:bg-brand-900 transition-colors">
          Mint an iNFT
        </Link>
        <Link href="/demo"
          className="px-6 py-3 border border-brand-500 text-brand-500 rounded-lg font-semibold hover:bg-brand-50 transition-colors">
          Live Demo
        </Link>
        <Link href="/earnings"
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors">
          My Earnings
        </Link>
      </div>
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
        {[
          { title: "On-chain Lineage Graph", desc: "Every iNFT records its parents at mint time. The DAG is enforced acyclic by LineageRegistry." },
          { title: "DA Attribution Receipts", desc: "Each inference emits a TEE-signed receipt on 0G DA — cheap, immutable, verifiable." },
          { title: "Merkle Royalty Settlement", desc: "Contributors withdraw proportional payouts via Merkle proof. Gas-efficient, pull-only." },
        ].map((card) => (
          <div key={card.title} className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
            <h3 className="font-semibold text-brand-900 mb-2">{card.title}</h3>
            <p className="text-sm text-gray-600">{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
