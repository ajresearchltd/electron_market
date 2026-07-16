import Header from'../components/homepage/Header';import Footer from'../components/homepage/Footer';import SuppliersDirectory from'./SuppliersDirectory';
export const metadata={title:'Verified Suppliers | Electron Market',description:'Explore verified component suppliers available through Electron Market.'};
export default function SuppliersPage(){return <main className="min-h-screen bg-[#f5f8fc] text-slate-950"><Header/><SuppliersDirectory/><Footer/></main>}
