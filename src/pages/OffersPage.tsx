// src/pages/OffersPage.tsx
import React, { useEffect, useMemo, useState, type JSX } from "react";

type OfferStatus = "Draft" | "Sent" | "Accepted" | "Rejected";

type Offer = {
  id: string;
  candidateName: string;
  candidateEmail: string;
  position: string;
  salary: string;
  note?: string;
  status: OfferStatus;
  createdAt: string;
};

const sampleOffers = (): Offer[] => [
  {
    id: "o-1",
    candidateName: "Nguyễn Văn A",
    candidateEmail: "a.nguyen@example.com",
    position: "Frontend Engineer",
    salary: "₫25,000,000 / tháng",
    note: "Offer for Senior frontend role",
    status: "Sent",
    createdAt: new Date().toISOString(),
  },
  {
    id: "o-2",
    candidateName: "Trần Thị B",
    candidateEmail: "b.tran@example.com",
    position: "Backend Engineer",
    salary: "₫28,000,000 / tháng",
    note: "Offer with probation 2 months",
    status: "Draft",
    createdAt: new Date().toISOString(),
  },
];

function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function OffersPage(): JSX.Element {
  const [offers, setOffers] = useState<Offer[]>(() => sampleOffers());
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // form state
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [position, setPosition] = useState("");
  const [salary, setSalary] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 3000);
    return () => clearTimeout(t);
  }, [notification]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter(
      (o) =>
        o.candidateName.toLowerCase().includes(q) ||
        o.position.toLowerCase().includes(q) ||
        o.candidateEmail.toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q)
    );
  }, [offers, query]);

  const openCreate = () => {
    setEditing(null);
    setCandidateName("");
    setCandidateEmail("");
    setPosition("");
    setSalary("");
    setNote("");
    setShowModal(true);
  };

  const openEdit = (o: Offer) => {
    setEditing(o);
    setCandidateName(o.candidateName);
    setCandidateEmail(o.candidateEmail);
    setPosition(o.position);
    setSalary(o.salary);
    setNote(o.note || "");
    setShowModal(true);
  };

  const saveOffer = () => {
    if (!candidateName || !candidateEmail || !position || !salary) {
      setNotification("Vui lòng điền đầy đủ thông tin bắt buộc.");
      return;
    }

    if (editing) {
      setOffers((prev) =>
        prev.map((p) =>
          p.id === editing.id
            ? { ...p, candidateName, candidateEmail, position, salary, note }
            : p
        )
      );
      setNotification("Cập nhật offer thành công.");
    } else {
      const newOffer: Offer = {
        id: uid("offer"),
        candidateName,
        candidateEmail,
        position,
        salary,
        note,
        status: "Draft",
        createdAt: new Date().toISOString(),
      };
      setOffers((prev) => [newOffer, ...prev]);
      setNotification("Tạo offer mới thành công.");
    }
    setShowModal(false);
  };

  const deleteOffer = (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa offer này?")) return;
    setOffers((prev) => prev.filter((p) => p.id !== id));
    setNotification("Đã xóa offer.");
  };

  const sendOffer = (id: string) => {
    // simulate send: set status = Sent
    setOffers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "Sent" } : p))
    );
    setNotification("Gửi offer thành công (demo).");
  };

  const markAccepted = (id: string) =>
    setOffers((prev) => prev.map((p) => (p.id === id ? { ...p, status: "Accepted" } : p)));

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Offer Management</h1>
          <p className="text-sm text-gray-500">Tạo, quản lý và gửi offer cho ứng viên.</p>
        </div>

        <div className="flex items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên, vị trí, email, trạng thái..."
            className="border rounded px-3 py-2 text-sm"
          />
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Tạo Offer
          </button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded">
          {notification}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto bg-white shadow rounded">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Ứng viên</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Vị trí</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Lương</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Trạng thái</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Ngày tạo</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                  Không có offer nào.
                </td>
              </tr>
            ) : (
              filtered.map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{o.candidateName}</div>
                    <div className="text-xs text-gray-500">{o.candidateEmail}</div>
                  </td>
                  <td className="px-4 py-3">{o.position}</td>
                  <td className="px-4 py-3">{o.salary}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 text-xs rounded ${
                        o.status === "Draft"
                          ? "bg-gray-100 text-gray-800"
                          : o.status === "Sent"
                          ? "bg-blue-100 text-blue-800"
                          : o.status === "Accepted"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(o.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEdit(o)}
                      className="text-sm px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                    >
                      Sửa
                    </button>

                    <button
                      onClick={() => sendOffer(o.id)}
                      disabled={o.status === "Sent" || o.status === "Accepted"}
                      className="text-sm px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
                    >
                      Gửi
                    </button>

                    <button
                      onClick={() => markAccepted(o.id)}
                      disabled={o.status !== "Sent"}
                      className="text-sm px-2 py-1 bg-green-600 text-white rounded disabled:opacity-50"
                    >
                      Chấp nhận
                    </button>

                    <button
                      onClick={() => deleteOffer(o.id)}
                      className="text-sm px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: create / edit */}
      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded shadow-lg w-full max-w-2xl overflow-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">{editing ? "Chỉnh sửa Offer" : "Tạo Offer mới"}</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700 px-2 py-1"
              >
                Đóng
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tên ứng viên</label>
                <input
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className="mt-1 w-full border rounded px-3 py-2"
                  placeholder="Ví dụ: Nguyễn Văn A"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email ứng viên</label>
                <input
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  className="mt-1 w-full border rounded px-3 py-2"
                  placeholder="email@domain.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Vị trí</label>
                  <input
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2"
                    placeholder="Frontend Engineer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Lương</label>
                  <input
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2"
                    placeholder="₫25,000,000 / tháng"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Ghi chú</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1 w-full border rounded px-3 py-2"
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowModal(false);
                  }}
                  className="px-4 py-2 rounded border"
                >
                  Hủy
                </button>
                <button onClick={saveOffer} className="px-4 py-2 bg-blue-600 text-white rounded">
                  {editing ? "Lưu thay đổi" : "Tạo & Lưu"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
