import './Body.css';

interface BodyProps {
  isSidebarOpen: boolean;
}

function Body({ isSidebarOpen }: BodyProps) {
  return (
    <main className={`body-content ${isSidebarOpen ? 'body-with-sidebar' : 'body-full'}`}>
      {/* เนื้อหาหลัก - รอเพิ่มเนื้อหาภายหลัง */}
    </main>
  );
}

export default Body;
