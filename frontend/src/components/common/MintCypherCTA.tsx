const MINT_URL = "https://hotcraft.art/drop/Cypher_Quad";

const MintCypherCTA = () => {
  return (
    <div className="sticky top-0 z-50 w-full bg-[#040022] px-4 py-3">
      <a
        href={MINT_URL}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center rounded-full bg-gradient-to-r from-[#8E2DE2] via-[#4A00E0] to-[#00C6FF] px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-white shadow-lg transition-all duration-200 hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-sm"
      >
        Mint the Cypher Squad NFT
      </a>
    </div>
  );
};

export default MintCypherCTA;

