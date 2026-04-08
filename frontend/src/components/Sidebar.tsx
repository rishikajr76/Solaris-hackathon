import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  BarChart3,
  Package,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

const menuItems = [
  { label: "Home", icon: Home, path: "/" },
  { label: "Dashboard", icon: BarChart3, path: "/dashboard" },
  { label: "Projects", icon: Package, path: "/projects" },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <>
      {/* 🔥 Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-slate-800 border border-slate-700"
      >
        {isOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* 🔥 Sidebar */}
      <motion.aside
        initial={{ x: -260 }}
        animate={{ x: isOpen || window.innerWidth >= 768 ? 0 : -260 }}
        className="fixed md:relative top-0 left-0 h-screen w-64 z-40
                   bg-slate-900/80 backdrop-blur-md border-r border-slate-800
                   p-6 flex flex-col justify-between transition-transform"
      >
        {/* Top Section */}
        <div>
          {/* Logo */}
          <div className="mb-10">
            <h1 className="text-2xl font-bold text-white tracking-wide">
              Sentinel-AG
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Code Intelligence Platform
            </p>
          </div>

          {/* Navigation */}
          <nav className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <motion.button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setIsOpen(false);
                  }}
                  whileHover={{ x: 6 }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300
                    ${
                      isActive
                        ? "bg-gradient-to-r from-purple-600/20 to-cyan-500/20 text-white border border-cyan-400/20"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                    }`}
                >
                  <Icon size={18} />
                  <span className="font-medium">{item.label}</span>
                </motion.button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="space-y-4">
          {/* User Info */}
          {user && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
              <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {user.email?.charAt(0).toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-sm text-white">{user.email}</p>
                <p className="text-xs text-slate-400">Logged in</p>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-slate-800" />

          {/* Sign Out */}
          <motion.button
            onClick={handleSignOut}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                       bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400
                       border border-slate-700 transition-all duration-300"
          >
            <LogOut size={18} />
            <span className="font-medium">Sign Out</span>
          </motion.button>
        </div>
      </motion.aside>

      {/* 🔥 Mobile Overlay */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
        />
      )}
    </>
  );
}