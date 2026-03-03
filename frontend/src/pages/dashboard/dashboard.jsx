import React, { useState, useEffect, useRef } from 'react';
import { account, Query, DATABASE_ID, COLLECTION_ID, databases, STORAGE_BUCKET_ID, storage, ID } from './../../../appwriteConfig';
import { decryptData } from '../../utils/encryption';
import { TbLogout2 } from "react-icons/tb";
import { QRCodeCanvas } from 'qrcode.react';
import { FaFileAlt, FaUpload, FaFileMedical, FaTrash } from "react-icons/fa";
import { MdClose } from "react-icons/md";
import chatService from '../../services/textsummary';
import { Permission, Role } from 'appwrite';

const Dashboard = () => {
  const [isLoggedOut, setIsLoggedOut] = useState(false);
  const [userData, setUserData] = useState({
    name: '', 
    email: '', 
    dob: '', 
    fatherName: '', 
    motherName: '', 
    fatherPhone: '', 
    motherPhone: '', 
    bloodGroup: '', 
    allergies: '', 
    vaccinations: ''
  });
  const [loading, setLoading] = useState(true);
  const [imagesLoading, setImagesLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [showUploadOption, setShowUploadOption] = useState(false);
  
  // Medical images states
  const [medicalFiles, setMedicalFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  
  // Report summary states
  const [showReportSummary, setShowReportSummary] = useState(false);
  const [reportSummary, setReportSummary] = useState('');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [loadingDots, setLoadingDots] = useState('.');
  
  const fileInputRef = useRef(null);
  const qrRef = useRef();
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (isLoggedOut) return;

    const fetchUserData = async () => {
      try {
        const userDataString = localStorage.getItem("authData");
        if (!userDataString) {
          throw new Error('No user data found');
        }
        const decryptedAuthData = decryptData(userDataString);
        const user = JSON.parse(decryptedAuthData);
        
        const userId = user.uid;
        setUserId(userId);
        
        const response = await databases.listDocuments(
          DATABASE_ID,
          COLLECTION_ID,
          [Query.equal('userId', userId)]
        );

        if (response.documents && response.documents.length > 0) {
          const document = response.documents[0];

          setUserData({
            name: document.name,
            email: document.email,
            dob: document.dob,
            fatherName: document.fatherName,
            motherName: document.motherName,
            fatherPhone: document.fatherPhone,
            motherPhone: document.motherPhone,
            bloodGroup: document.bloodGroup,
            allergies: document.allergies,
            vaccinations: document.vaccinations
          });
        }
        
        // Fetch medical files
        await fetchMedicalFiles(userId);
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [isLoggedOut]);

  // Loading dots animation effect
  useEffect(() => {
    if (generatingSummary) {
      const interval = setInterval(() => {
        setLoadingDots(prev => {
          if (prev.length >= 4) return '.';
          return prev + '.';
        });
      }, 500);
      
      return () => clearInterval(interval);
    }
  }, [generatingSummary]);

  const fetchMedicalFiles = async (userId) => {
    setImagesLoading(true);
    try {
      // Fetch file records from the database
      const response = await databases.listDocuments(
        DATABASE_ID,
        '67f4c40a0006d21b7671',
        [Query.equal('userId', userId)]
      );
      
      if (response.documents && response.documents.length > 0) {
        const files = response.documents.map(doc => {
          const originalFileUrl = storage.getFileView(
            STORAGE_BUCKET_ID,
            doc.fileId
          );
          
          return {
            id: doc.$id,
            fileId: doc.fileId,
            name: doc.fileName || 'Medical File',
            description: doc.description || '',
            fileUrl: originalFileUrl.toString(), 
            uploadDate: new Date(doc.$createdAt).toLocaleDateString()
          };
        });
        
        setMedicalFiles(files);
      } else {
        setMedicalFiles([]);
      }
    } catch (error) {
      console.error('Error fetching medical files:', error);
      setMedicalFiles([]);
    } finally {
      setImagesLoading(false);
    }
  };

  const toggleUploadPanel = () => {
    setShowUploadOption(!showUploadOption);
  };

  const handleLogout = async () => {
    try {
      setIsLoggedOut(true);
      localStorage.removeItem("authData");
      await account.deleteSession('current');
      window.location.href = '/';
    } catch (err) {
      console.error('Logout failed:', err);
      setIsLoggedOut(false); 
    }
  };

  const downloadQRCode = () => {
    if (!qrRef.current) return;
    
    const canvas = qrRef.current;
    const image = canvas.toDataURL("image/png");
    const link = document.createElement('a');
    
    link.href = image;
    link.download = `${userData.name}-medical-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const closeQROverlay = () => {
    setShowQR(false);
  };

  const closeReportSummary = () => {
    setShowReportSummary(false);
  };

  const processMessage = async (newMessage) => {
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setChatLoading(true);
    
    try {
      // Format message for API
      const messagesForAPI = updatedMessages.map(msg => ({
        role: msg.role,
        content: msg.image 
          ? [
              { type: "text", text: msg.content },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${msg.image}` } }
            ]
          : msg.content
      }));
      
      const response = await chatService.sendMessage(messagesForAPI);
      
      if (response.choices && response.choices.length > 0) {
        const responseMessage = {
          role: 'assistant',
          content: response.choices[0].message.content
        };
        
        setMessages([...updatedMessages, responseMessage]);
        return responseMessage.content;
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages([
        ...updatedMessages,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again later.'
        }
      ]);
      return 'Sorry, I encountered an error. Please try again later.';
    } finally {
      setChatLoading(false);
    }
  };

  const generateDiagnosisReport = async () => {
    setShowReportSummary(true);
    setGeneratingSummary(true);
    setReportSummary('');
    
    try {
      const fileNames = medicalFiles.map(file => file.name).join(', ');
      
      const reportRequest = {
        role: 'user',
        content: `Based on my medical details (Name: ${userData.name}, DOB: ${userData.dob}, Blood Type: ${userData.bloodGroup}, Allergies: ${userData.allergies || 'None'}, Vaccinations: ${userData.vaccinations || 'None'}, Medical files: ${fileNames || 'None'}), please generate a brief medical summary in a single paragraph highlighting key health aspects, potential concerns based on available information, and general health recommendations.`
      };
      
      const summary = await processMessage(reportRequest);
      setReportSummary(summary);
    } catch (error) {
      console.error('Error generating report:', error);
      setReportSummary('Failed to generate report. Please try again later.');
    } finally {
      setGeneratingSummary(false);
    }
  };

  // File upload handling
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current.click();
  };

  const uploadFile = async () => {
    if (!selectedFile || !userId) return;
    
    setUploading(true);
    try {
      // 1. Upload file to storage
      const fileId = ID.unique();
      const uploadResponse = await storage.createFile(
        STORAGE_BUCKET_ID,
        fileId,
        selectedFile
      );
      
      // 2. Create document in database with reference to the file
      await databases.createDocument(
        DATABASE_ID,
        '67f4c40a0006d21b7671',
        ID.unique(),
        {
          userId: userId,
          fileId: uploadResponse.$id,
          fileName: selectedFile.name,
          description: '',
          fileType: selectedFile.type
        },
        [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId))
        ]
      );
      
      // 3. Reset and refresh the files list
      setSelectedFile(null);
      setPreviewUrl('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchMedicalFiles(userId);
      
    } catch (error) {
      console.error('Error uploading medical file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const cancelUpload = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const viewImage = (image) => {
    setSelectedImage(image);
    setShowImageModal(true);
  };

  const deleteFile = async (fileId, docId) => {
    try {
      // Delete the document from the database
      await databases.deleteDocument(
        DATABASE_ID,
        '67f4c40a0006d21b7671',
        docId
      );
      
      // Delete the file from storage
      await storage.deleteFile(
        STORAGE_BUCKET_ID,
        fileId
      );
      
      // Update the files list
      setMedicalFiles(medicalFiles.filter(file => file.id !== docId));
      
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-300"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-gray-900 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-blue-300">Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 flex gap-1 items-center bg-blue-600 hover:bg-blue-800 text-white rounded-md transition duration-150"
          >
            Logout <TbLogout2 />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="bg-gray-900 rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Welcome, {userData?.name}!</h2>
          <p className="text-gray-300">
            Here you can view and manage your medical information. Generate a QR code for quick access to your medical details.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Personal Information */}
          <div className="bg-gray-900 rounded-lg shadow-lg p-6 col-span-2">
            <h3 className="text-lg font-medium text-blue-300 mb-4 pb-2 border-b border-gray-700">
              Personal Information
            </h3>
            {userData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Full Name</p>
                  <p className="font-medium">{userData.name}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Email</p>
                  <p className="font-medium">{userData.email}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Date of Birth</p>
                  <p className="font-medium">{userData.dob}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Blood Group</p>
                  <p className="font-medium">{userData.bloodGroup}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Father's Name</p>
                  <p className="font-medium">{userData.fatherName || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Father's Phone</p>
                  <p className="font-medium">{userData.fatherPhone || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Mother's Name</p>
                  <p className="font-medium">{userData.motherName || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Mother's Phone</p>
                  <p className="font-medium">{userData.motherPhone || 'Not provided'}</p>
                </div>
              </div>
            ) : (
              <p className="text-gray-400">No personal information available.</p>
            )}
          </div>

          {/* Medical Information */}
          <div className="bg-gray-900 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-medium text-blue-300 mb-4 pb-2 border-b border-gray-700">
              Medical Information
            </h3>
            {userData ? (
              <div className="space-y-4">
                <div>
                  <p className="text-gray-400 text-sm">Allergies</p>
                  <p className="font-medium">{userData.allergies || 'None reported'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Vaccinations</p>
                  <p className="font-medium">{userData.vaccinations || 'None reported'}</p>
                </div>
                <div className="pt-4">
                  <button
                    onClick={() => setShowQR(true)}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-800 text-white rounded-md transition duration-150"
                  >
                    Show QR Code
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-gray-400">No medical information available.</p>
            )}
          </div>
        </div>

        {/* Medical Reports & Images Section */}
        <div className="bg-gray-900 rounded-lg shadow-lg p-6 mb-8 relative">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-700">
            <h3 className="text-lg font-medium text-blue-300 flex items-center">
              <FaFileMedical className="mr-2" /> Medical Reports & Images
            </h3>
            
            {/* Plus button */}
            <button 
              onClick={toggleUploadPanel}
              className={`w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center shadow-lg transition-all duration-300 ${showUploadOption ? 'rotate-45' : ''}`}
              title="Upload new file"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          
          {/* Slide-down upload panel */}
          <div 
            className={`transform transition-all duration-300 overflow-hidden ${
              showUploadOption ? 'max-h-96 opacity-100 mb-6' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              {!selectedFile ? (
                <div className="flex flex-col items-center justify-center py-6">
                  <FaUpload className="text-blue-300 text-3xl mb-3" />
                  <p className="text-gray-300 text-center mb-4">Upload medical reports, scans, or other health documents</p>
                  <button
                    onClick={triggerFileUpload}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-800 text-white rounded-md transition duration-150"
                  >
                    Select File
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*,.pdf"
                  />
                </div>
              ) : (
                <div className="flex flex-col md:flex-row items-center">
                  <div className="w-full md:w-1/3 mb-4 md:mb-0 md:mr-4">
                    <div className="bg-gray-900 p-2 rounded-lg">
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="w-full h-auto max-h-48 object-contain rounded"
                      />
                    </div>
                  </div>
                  <div className="w-full md:w-2/3 flex flex-col">
                    <p className="font-medium text-blue-300 mb-2">{selectedFile?.name}</p>
                    <p className="text-gray-400 text-sm mb-4">
                      {selectedFile?.type} · {(selectedFile?.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                    <div className="flex space-x-3 mt-auto">
                      <button
                        onClick={uploadFile}
                        disabled={uploading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-800 text-white rounded-md transition duration-150 flex items-center"
                      >
                        {uploading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                            Uploading...
                          </>
                        ) : (
                          <>Upload</>
                        )}
                      </button>
                      <button
                        onClick={cancelUpload}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-md transition duration-150"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Medical Files Gallery */}
          {imagesLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-300"></div>
            </div>
          ) : medicalFiles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {medicalFiles.map((file) => (
                <div key={file.id} className="bg-gray-800 rounded-lg overflow-hidden shadow-md transition-transform hover:scale-105 duration-200">
                  <div 
                    className="h-48 bg-gray-700 cursor-pointer flex items-center justify-center" 
                    onClick={() => viewImage(file)}
                  >
                    <img 
                      src={file.fileUrl} // Using the original file URL here
                      alt={file.name} 
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "https://via.placeholder.com/400x300?text=Image+Not+Available";
                      }}
                    />
                  </div>
                  <div className="p-3">
                    <div className="flex justify-between items-start">
                      <h4 className="text-blue-300 font-medium truncate">{file.name}</h4>
                      <button 
                        onClick={() => deleteFile(file.fileId, file.id)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                        title="Delete file"
                      >
                        <FaTrash size={14} />
                      </button>
                    </div>
                    <p className="text-gray-400 text-xs mt-1">{file.uploadDate}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400 border border-gray-800 rounded-lg">
              <FaFileMedical className="text-blue-300 text-3xl mb-2 opacity-50" />
              <p className="mb-1">No medical files uploaded yet</p>
              <p className="text-sm">Upload your medical reports and images for safekeeping</p>
            </div>
          )}
        </div>
      </main>

      {/* QR Code Overlay */}
      {showQR && userData && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg shadow-lg p-6 max-w-md w-full text-center relative">
            <button 
              onClick={closeQROverlay}
              className="absolute top-3 right-3 text-gray-400 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <h3 className="text-lg font-medium text-blue-300 mb-4">
              Medical Information QR Code
            </h3>
            <div className="flex flex-col items-center justify-center">
              <div className="bg-white p-4 rounded-lg mb-4">
                <QRCodeCanvas
                  id="qr-canvas"
                  value={JSON.stringify({
                    name: userData.name,
                    dob: userData.dob,
                    bloodGroup: userData.bloodGroup,
                    allergies: userData.allergies || 'None',
                    vaccinations: userData.vaccinations || 'None',
                    emergencyContact: userData.fatherPhone || userData.motherPhone || 'None'
                  })}
                  size={200}
                  level={"H"}
                  includeMargin={true}
                  ref={qrRef}
                />
              </div>
              <button
                onClick={downloadQRCode}
                className="px-4 py-2 bg-blue-300 hover:bg-blue-400 text-black font-medium rounded-md transition duration-150"
              >
                Download QR Code
              </button>
              <p className="text-sm text-gray-400 mt-2">
                This QR code contains your essential medical information for emergency situations.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Medical Report Summary Overlay */}
      {showReportSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg shadow-lg p-6 max-w-2xl w-full relative animate-fadeIn">
            <button 
              onClick={closeReportSummary}
              className="absolute top-3 right-3 text-gray-400 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-blue-300">
                Medical Report Summary
              </h3>
              <div className="w-16 h-1 bg-blue-500 mx-auto mt-2"></div>
            </div>
            
            {generatingSummary ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-300 mb-4"></div>
                <p className="text-lg text-gray-300">
                  Generating Summary{loadingDots}
                </p>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg p-6 shadow-inner">
                <p className="text-gray-200 leading-relaxed">
                  {reportSummary}
                </p>
                <div className="mt-6 pt-4 border-t border-gray-700">
                  <p className="text-sm text-gray-400 italic">
                    Disclaimer: This summary is based on the information provided and should not replace professional medical advice. Please consult with healthcare professionals for accurate diagnoses and treatment plans.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {showImageModal && selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="max-w-4xl w-full p-4 relative">
            <button 
              onClick={() => setShowImageModal(false)}
              className="absolute top-2 right-2 text-white bg-gray-800 rounded-full p-2 hover:bg-gray-700 transition-colors z-10"
            >
              <MdClose size={24} />
            </button>
            
            <div className="bg-gray-900 rounded-lg shadow-lg overflow-hidden">
              <div className="bg-black flex items-center justify-center">
                <img 
                  src={selectedImage.fileUrl}
                  alt={selectedImage.name} 
                  className="w-full h-auto max-h-[70vh] object-contain"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "https://via.placeholder.com/800x600?text=Image+Not+Available";
                  }}
                />
              </div>
              <div className="p-4">
                <h3 className="text-lg font-medium text-blue-300">{selectedImage.name}</h3>
                <p className="text-gray-400 text-sm mt-1">Uploaded on {selectedImage.uploadDate}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom action buttons */}
      <div className="fixed bottom-6 right-6 flex space-x-2 z-40">
        <button
          onClick={generateDiagnosisReport}
          className="h-14 px-4 bg-blue-600 hover:bg-blue-800 rounded-md flex items-center justify-center shadow-lg transition duration-150"
        >
          <FaFileAlt className="h-5 w-5 mr-2 text-white" />
          <span className="text-white text-sm">Get Diagnosis Report</span>
        </button>
      </div>
    </div>
  );
};

export default Dashboard;